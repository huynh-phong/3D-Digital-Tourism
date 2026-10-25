"use client";

import { useEffect, useRef, useState } from "react";
import { GROUNDS, PALACE, ROOMS, floorFromY } from "@/data/dinh/layout";
import { INTERACTABLES, TOUR_STOPS } from "@/data/dinh/tour";
import { loc, useLang, useT } from "@/lib/i18n";
import { runtime, useGame, useProgress } from "@/lib/store/game";
import { goToStop, STAIR_POINTS } from "@/lib/tour/director";
import type { FloorId } from "@/types";
import { Modal, Segmented } from "@/components/ui/primitives";

/** Schematic floor plan with live player/guide positions. */
export function FloorMap() {
  const t = useT();
  const lang = useLang();
  const open = useGame((s) => s.mapOpen);
  const floorNow = useGame((s) => s.floor);
  const completed = useProgress((s) => s.completed);
  const [picked, setFloor] = useState<FloorId | null>(null);
  const floor = picked ?? floorNow;
  const player = useRef<SVGGElement>(null);
  const guide = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const tick = () => {
      const [x, y, z] = runtime.player;
      if (player.current) {
        player.current.setAttribute("transform", `translate(${x} ${z}) rotate(${(-runtime.playerYaw * 180) / Math.PI + 180})`);
        player.current.style.opacity = floorFromY(y) === floor ? "1" : "0.25";
      }
      if (guide.current) {
        guide.current.setAttribute("cx", String(runtime.guide[0]));
        guide.current.setAttribute("cy", String(runtime.guide[2]));
        guide.current.style.opacity = floorFromY(runtime.guide[1]) === floor ? "1" : "0.25";
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [open, floor]);

  const grounds = floor === "grounds";
  const vb = grounds
    ? `${-GROUNDS.halfW - 10} ${-GROUNDS.halfD - 10} ${GROUNDS.halfW * 2 + 20} ${GROUNDS.halfD * 2 + 20}`
    : `${PALACE.front.x0 - 6} ${PALACE.rear.z0 - 6} ${PALACE.front.x1 - PALACE.front.x0 + 12} ${PALACE.front.z1 - PALACE.rear.z0 + 18}`;
  const sw = grounds ? 1.2 : 0.35;

  return (
    <Modal open={open} onClose={() => { setFloor(null); useGame.setState({ mapOpen: false }); }} title={t.tour.floorMap} wide>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Segmented<FloorId>
          label={t.tour.floorMap}
          value={floor}
          onChange={setFloor}
          options={(["grounds", "f1", "basement", "roof"] as FloorId[]).map((f) => ({ value: f, label: t.tour.floors[f] }))}
        />
        <p className="text-[11px] text-muted">{loc(ROOMS[0].note, lang)}</p>
      </div>
      <svg viewBox={vb} className="h-[min(56vh,520px)] w-full rounded-xl bg-bg-2" role="img" aria-label={`${t.tour.floorMap}: ${t.tour.floors[floor]}`}>
        {grounds ? (
          <>
            <rect x={-GROUNDS.halfW} y={-GROUNDS.halfD} width={GROUNDS.halfW * 2} height={GROUNDS.halfD * 2} fill="#9cc884" stroke="var(--text)" strokeWidth={sw} />
            <circle cx={GROUNDS.lawnCenter[0]} cy={GROUNDS.lawnCenter[1]} r={GROUNDS.ringRadius + GROUNDS.ringWidth / 2} fill="#d6cfbf" />
            <circle cx={GROUNDS.lawnCenter[0]} cy={GROUNDS.lawnCenter[1]} r={GROUNDS.lawnRadius} fill="#7cbc62" />
            <rect x={PALACE.front.x0} y={PALACE.front.z0} width={PALACE.front.x1 - PALACE.front.x0} height={PALACE.front.z1 - PALACE.front.z0} fill="#f2efe8" stroke="var(--text)" strokeWidth={sw} />
            <rect x={PALACE.rear.x0} y={PALACE.rear.z0} width={PALACE.rear.x1 - PALACE.rear.x0} height={PALACE.rear.z1 - PALACE.rear.z0} fill="#f2efe8" stroke="var(--text)" strokeWidth={sw} />
            <text x={0} y={GROUNDS.halfD + 8} fontSize={9} textAnchor="middle" fill="var(--text)">Nam Kỳ Khởi Nghĩa</text>
            <text x={0} y={-GROUNDS.halfD - 3} fontSize={9} textAnchor="middle" fill="var(--text)">Huyền Trân Công Chúa</text>
            <text x={GROUNDS.halfW + 4} y={0} fontSize={9} textAnchor="middle" fill="var(--text)" transform={`rotate(90 ${GROUNDS.halfW + 4} 0)`}>Nguyễn Thị Minh Khai</text>
            <text x={-GROUNDS.halfW - 4} y={0} fontSize={9} textAnchor="middle" fill="var(--text)" transform={`rotate(-90 ${-GROUNDS.halfW - 4} 0)`}>Nguyễn Du</text>
          </>
        ) : (
          <>
            <rect x={PALACE.front.x0} y={PALACE.front.z0} width={PALACE.front.x1 - PALACE.front.x0} height={PALACE.front.z1 - PALACE.front.z0} fill="var(--surface-solid)" stroke="var(--text)" strokeWidth={sw} />
            <rect x={PALACE.rear.x0} y={PALACE.rear.z0} width={PALACE.rear.x1 - PALACE.rear.x0} height={PALACE.rear.z1 - PALACE.rear.z0} fill="var(--surface-solid)" stroke="var(--text)" strokeWidth={sw} />
            {ROOMS.filter((r) => r.floor === floor && r.id !== "roof").map((r) => (
              <g key={r.id}>
                <rect x={r.rect.x0} y={r.rect.z0} width={r.rect.x1 - r.rect.x0} height={r.rect.z1 - r.rect.z0} fill={r.status === "simulated" ? "var(--bg-2)" : "var(--accent-soft)"} stroke="var(--muted)" strokeWidth={sw} strokeDasharray={r.status === "simulated" ? "1 1" : undefined} />
                <text x={(r.rect.x0 + r.rect.x1) / 2} y={(r.rect.z0 + r.rect.z1) / 2} fontSize={2.2} textAnchor="middle" fill="var(--text)">{loc(r.name, lang)}</text>
              </g>
            ))}
            {floor === "roof" && (
              <>
                <rect x={-12} y={-32} width={24} height={18} fill="none" stroke="var(--text)" strokeWidth={sw} />
                <rect x={-6} y={-27} width={12} height={8} fill="var(--accent-soft)" stroke="var(--text)" strokeWidth={sw} />
                <text x={0} y={-35} fontSize={2.4} textAnchor="middle" fill="var(--text)">Tứ phương vô sự lầu</text>
              </>
            )}
            {STAIR_POINTS.filter((s) => floorFromY(s.at[1]) === floor).map((s, i) => (
              <text key={i} x={s.at[0]} y={s.at[2] - 3} fontSize={2.6} textAnchor="middle" fill="var(--text)">⇅</text>
            ))}
          </>
        )}
        {INTERACTABLES.filter((i) => i.floor === floor).map((i) => (
          <rect key={i.id} x={i.position[0] - (grounds ? 3 : 0.8)} y={i.position[2] - (grounds ? 3 : 0.8)} width={grounds ? 6 : 1.6} height={grounds ? 6 : 1.6} fill="#d4a017" transform={`rotate(45 ${i.position[0]} ${i.position[2]})`}>
            <title>{loc(i.title, lang)}</title>
          </rect>
        ))}
        {TOUR_STOPS.filter((s) => s.floor === floor).map((s) => {
          const r = grounds ? 7 : 2;
          const done = completed.includes(s.id);
          return (
            <g key={s.id} onClick={() => { goToStop(s.id); useGame.setState({ mapOpen: false }); }} className="cursor-pointer">
              <circle cx={s.position[0]} cy={s.position[2]} r={r} fill={done ? "var(--accent)" : "var(--surface-solid)"} stroke="var(--accent)" strokeWidth={sw} />
              <text x={s.position[0]} y={s.position[2] + r * 0.38} fontSize={r * 1.05} textAnchor="middle" fill={done ? "var(--accent-contrast)" : "var(--text)"} fontWeight={700}>{done ? "✓" : s.order}</text>
              <title>{loc(s.title, lang)}</title>
            </g>
          );
        })}
        <circle ref={guide} r={grounds ? 3.5 : 1} fill="#1f3557" stroke="white" strokeWidth={sw} />
        <g ref={player}>
          <path d={grounds ? "M0 -6 L4.5 5 L0 2.5 L-4.5 5 Z" : "M0 -1.8 L1.4 1.5 L0 0.8 L-1.4 1.5 Z"} fill="var(--blue)" stroke="white" strokeWidth={sw * 0.6} />
        </g>
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted">
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-blue align-middle" />{t.tour.current}</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: "#1f3557" }} />{t.guide.name}</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rotate-45 align-middle" style={{ background: "#d4a017" }} />{t.tour.interact}</span>
        <span>✓ {t.tour.completed}</span>
        <span>⇅ {t.tour.useStairs}</span>
      </div>
    </Modal>
  );
}
