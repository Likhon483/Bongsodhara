"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { User, Crown, MapPin, UserPlus, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import type { PersonNodeData } from "@/lib/tree-layout";
import { formatLifeDates } from "@/lib/dateUtils";

export type PersonFlowNode = Node<PersonNodeData, "personNode">;

function PersonNodeComponent({ data }: NodeProps<PersonFlowNode>) {
  const { person, generation, isRoot, onSelectPerson } = data;

  const genderBadge =
    person.gender === "male"
      ? "bg-sky-50 text-sky-700 border-sky-200"
      : person.gender === "female"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : "bg-slate-100 text-slate-700 border-slate-200";

  const genderLabel =
    person.gender === "male"
      ? "পুরুষ"
      : person.gender === "female"
      ? "মহিলা"
      : "অন্যান্য";

  return (
    <div
      onClick={() => onSelectPerson(person)}
      className="group relative w-[220px] rounded-2xl bg-white border border-slate-200 hover:border-emerald-500 shadow-xs hover:shadow-md transition p-3.5 cursor-pointer select-none"
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-emerald-600 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-emerald-600 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-2 !h-2 !bg-rose-500 !border-2 !border-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!w-2 !h-2 !bg-rose-500 !border-2 !border-white"
      />

      <div className="flex items-start gap-2.5">
        <div
          className={`relative w-10 h-10 rounded-xl border overflow-hidden flex items-center justify-center shrink-0 ${genderBadge}`}
        >
          {person.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={person.avatar_url}
              alt={person.full_name_bn}
              className="w-full h-full object-cover"
            />
          ) : isRoot ? (
            <Crown className="w-5 h-5 text-amber-600" />
          ) : (
            <User className="w-5 h-5" />
          )}

          {person.avatar_url && isRoot && (
            <div className="absolute top-0 right-0 p-0.5 bg-amber-500 text-white rounded-bl-md">
              <Crown className="w-2.5 h-2.5" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-medium text-slate-400">
              প্রজন্ম {generation + 1}
            </span>
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${genderBadge}`}
            >
              {genderLabel}
            </span>
          </div>

          <h3 className="font-bold text-sm text-slate-900 truncate mt-0.5">
            {person.full_name_bn}
          </h3>

          {!person.is_alive && (
            <span className="inline-block text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded mt-0.5">
              মরহুম / প্রয়াত
            </span>
          )}

          {(() => {
            const { lifeSpanSummary } = formatLifeDates({
              birthDateAd: person.birth_date_ad,
              birthDateBs: person.birth_date_bs,
              deathDateAd: person.death_date_ad,
              isAlive: person.is_alive,
            });
            if (!lifeSpanSummary) return null;
            return (
              <p
                className="text-[10px] text-slate-500 flex items-center gap-1 truncate mt-0.5"
                title={lifeSpanSummary}
              >
                <Calendar className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                <span className="truncate">{lifeSpanSummary}</span>
              </p>
            );
          })()}

          {person.hometown_bn && (
            <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate mt-1">
              <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
              <span className="truncate">{person.hometown_bn}</span>
            </p>
          )}
        </div>
      </div>

      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-medium text-emerald-700 opacity-85 group-hover:opacity-100">
        <span>সম্পর্ক যোগ / দেখুন</span>
        <UserPlus className="w-3.5 h-3.5" />
      </div>

      {data.hasChildren && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            data.onToggleCollapse?.(person.id);
          }}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-xs px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-0.5 transition cursor-pointer"
          title={data.isCollapsed ? "শাখা প্রসারিত করুন" : "শাখা সংকুচিত করুন"}
        >
          {data.isCollapsed ? (
            <>
              <ChevronDown className="w-3 h-3" />
              <span>শাখা দেখুন</span>
            </>
          ) : (
            <>
              <ChevronUp className="w-3 h-3" />
              <span>সংকুচিত</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

export default memo(PersonNodeComponent);
