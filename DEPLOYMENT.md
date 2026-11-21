# বংশধারা (Bongshodhara) - Vercel ডিপ্লয়মেন্ট গাইড

এই ডকুমেন্টে 'বংশধারা' প্রজেক্টটি Vercel ক্লাউড প্ল্যাটফর্মে নিরাপদে এবং সহজে ডিপ্লয় করার সম্পূর্ণ পদ্ধতি দেওয়া হলো।

---

## ১. প্রয়োজনীয় Environment Variables

Vercel-এ ডিপ্লয় করার সময় **Project Settings > Environment Variables**-এ নিচের ভেরিয়েবলগুলো অবশ্যই যোগ করতে হবে:

| Variable Name | Required | বিবরণ | উদাহরণ মান |
| :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | **হ্যাঁ** | আপনার Supabase প্রজেক্টের API URL | `https://stpqiywpltwddbfhekmb.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **হ্যাঁ** | Supabase Anon / Publishable Key | `sb_publishable_...` |
| `NEXT_PUBLIC_SITE_URL` | *ঐচ্ছিক* | Vercel প্রোডাকশন ডোমেন (স্ল্যাশ ছাড়া) | `https://bongshodhara.vercel.app` |

---

## ২. ডিপ্লয় করার পদ্ধতি (GitHub-এর মাধ্যমে — সর্বাধিক প্রস্তাবিত)

১. **GitHub Repository তৈরি করুন:**
   - [github.com/new](https://github.com/new)-এ গিয়ে একটি নতুন রিপোজিটরি তৈরি করুন (যেমন: `bongshodhara` বা `bangla-family-tree`)।
   - আপনার কম্পিউটারে টার্মিনালে প্রজেক্ট ফোল্ডারে Git চালু করে ফাইলগুলো পুশ করুন:
     ```bash
     cd "e:/family tree/bangla-family-tree"
     git init
     git add .
     git commit -m "Initial commit for Bongshodhara"
     git branch -M main
     git remote add origin https://github.com/<আপনার-ইউজারনেম>/<রিপোজিটরির-নাম>.git
     git push -u origin main
     ```

২. **Vercel-এ ইমপোর্ট করুন:**
   - [vercel.com](https://vercel.com)-এ লগইন করে **"Add New... > Project"** সিলেক্ট করুন।
   - আপনার GitHub রিপোজিটরিটি সিলেক্ট করে **"Import"**-এ ক্লিক করুন।
   - **Root Directory সেটিং:**
     - যদি আপনি সরাসরি `bangla-family-tree` ফোল্ডারটিকে গিট রেপো হিসেবে পুশ করে থাকেন, তবে Root Directory `.` (default) থাকবে।
     - আর যদি প্যারেন্ট ফোল্ডার (`family tree`) পুশ করে থাকেন, তবে **Root Directory** অপশনে "Edit" ক্লিক করে `bangla-family-tree` ফোল্ডারটি সিলেক্ট করুন।
   - **Environment Variables:**
     - উপরে উল্লেখিত ৩টি ভেরিয়েবল যুক্ত করুন।
   - **"Deploy"** বাটনে ক্লিক করুন। ২ মিনিটের মধ্যে আপনার সাইট লাইভ হয়ে যাবে!

---

## ৩. বিকল্প পদ্ধতি: Vercel CLI ব্যবহার করে সরাসরি ডিপ্লয়

যদি GitHub ছাড়া সরাসরি টার্মিনাল থেকেই ডিপ্লয় করতে চান:
```bash
# ১. গ্লোবালি Vercel CLI ইনস্টল করুন
npm install -g vercel

# ২. বংশধারা প্রজেক্ট ফোল্ডারে প্রবেশ করুন
cd "e:/family tree/bangla-family-tree"

# ৩. Vercel অ্যাকাউন্টে লগইন করুন
vercel login

# ৪. প্রোডাকশন ডিপ্লয় করুন
vercel --prod
```

---

## ৪. ডিপ্লয়মেন্ট পরবর্তী গুরুত্বপূর্ণ ধাপ (Supabase Auth সেটিংস)

Vercel-এ লাইভ হওয়ার পর আপনার সাইটের URL-টি (যেমন: `https://bongshodhara.vercel.app`) নিন এবং [Supabase Dashboard](https://supabase.com/dashboard)-এ গিয়ে:

1. **Authentication > URL Configuration** মেনুতে যান।
2. **Site URL:** আপনার Vercel URL সেট করুন (যেমন: `https://bongshodhara.vercel.app`)।
3. **Redirect URLs (Allow list):** নিচের URL গুলো যোগ করে `Save` করুন:
   - `https://bongshodhara.vercel.app/**`
   - `https://bongshodhara.vercel.app/reset-password`
   - `https://bongshodhara.vercel.app/auth/callback`
   - `http://localhost:3001/**` *(লোকাল টেস্টের জন্য)*

এটি নিশ্চিত করবে যে ব্যবহারকারীরা পাসওয়ার্ড রিসেট বা ইমেইল ভেরিফিকেশনের লিংকে ক্লিক করলে কোনো এরর ছাড়াই সরাসরি আপনার লাইভ Vercel অ্যাপে প্রবেশ করতে পারবেন।
