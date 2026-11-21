import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getSafeOrigin(request: Request, requestUrl: URL): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host") || requestUrl.host;
  let cleanHost = host;
  // Replace 0.0.0.0 with localhost to prevent browser ERR_ADDRESS_INVALID
  if (cleanHost.startsWith("0.0.0.0")) {
    cleanHost = cleanHost.replace("0.0.0.0", "localhost");
  }
  const proto =
    request.headers.get("x-forwarded-proto") ||
    (requestUrl.protocol ? requestUrl.protocol.replace(":", "") : "http");
  return `${proto}://${cleanHost}`;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";
  const error = requestUrl.searchParams.get("error");
  const errorCode = requestUrl.searchParams.get("error_code");
  const errorDescription = requestUrl.searchParams.get("error_description");

  const baseOrigin = getSafeOrigin(request, requestUrl);

  // If Supabase returned an explicit error in query parameters
  if (error || errorCode) {
    const isExpired =
      errorCode === "otp_expired" ||
      (errorDescription && errorDescription.toLowerCase().includes("expired")) ||
      (error && error.toLowerCase().includes("expired"));

    const redirectUrl = new URL("/login", baseOrigin);
    if (isExpired) {
      redirectUrl.searchParams.set(
        "error",
        "রিসেট লিংকটি মেয়াদোত্তীর্ণ বা অবৈধ, অনুগ্রহ করে নতুন করে রিসেট লিংক পাঠান।"
      );
      redirectUrl.searchParams.set("mode", "forgot");
    } else {
      redirectUrl.searchParams.set(
        "error",
        errorDescription || error || "অথেনটিকেশন প্রক্রিয়ায় সমস্যা হয়েছে।"
      );
    }
    return NextResponse.redirect(redirectUrl);
  }

  if (code) {
    const cookieStore = await cookies();
    const targetPath = next.startsWith("/") ? next : `/${next}`;
    const response = NextResponse.redirect(new URL(targetPath, baseOrigin));

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
                response.cookies.set(name, value, options);
              });
            } catch {
              // Ignore if called in read-only mode
            }
          },
        },
      }
    );

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeError) {
      return response;
    }

    // Code exchange error (e.g. PKCE verifier missing in different browser, or expired)
    const lowerMsg = exchangeError.message.toLowerCase();
    const isCodeVerifier =
      lowerMsg.includes("code verifier") ||
      lowerMsg.includes("code_verifier") ||
      lowerMsg.includes("pkce") ||
      lowerMsg.includes("both auth_code and code_verifier");

    const isExpired =
      lowerMsg.includes("expired") || lowerMsg.includes("otp") || lowerMsg.includes("invalid");

    // If target was /reset-password, forward directly to /reset-password with error
    if (next.includes("reset-password")) {
      const redirectUrl = new URL("/reset-password", baseOrigin);
      if (isCodeVerifier) {
        redirectUrl.searchParams.set("error", "pkce_verifier_missing");
      } else if (isExpired) {
        redirectUrl.searchParams.set("error", "otp_expired");
      } else {
        redirectUrl.searchParams.set("error", exchangeError.message);
      }
      return NextResponse.redirect(redirectUrl);
    }

    const redirectUrl = new URL("/login", baseOrigin);
    if (isCodeVerifier) {
      redirectUrl.searchParams.set("error", "pkce_verifier_missing");
      redirectUrl.searchParams.set("mode", "forgot");
    } else if (isExpired) {
      redirectUrl.searchParams.set(
        "error",
        "রিসেট লিংকটি মেয়াদোত্তীর্ণ বা অবৈধ, অনুগ্রহ করে নতুন করে রিসেট লিংক পাঠান।"
      );
      redirectUrl.searchParams.set("mode", "forgot");
    } else {
      redirectUrl.searchParams.set("error", exchangeError.message);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // If no code, redirect to next destination
  const targetPath = next.startsWith("/") ? next : `/${next}`;
  return NextResponse.redirect(new URL(targetPath, baseOrigin));
}
