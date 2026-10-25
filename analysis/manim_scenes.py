"""슬라이드용 manim 애니메이션 (LaTeX 없이 Text만 사용)

렌더: manim render -r 1280,1040 --fps 30 analysis/manim_scenes.py LorenzScene ScatterScene
"""
import json
import math
from pathlib import Path

import numpy as np
from manim import (
    Axes, Create, DashedLine, Dot, FadeIn, GrowFromCenter, Line, Polygon, Scene, Text, VGroup,
    ValueTracker, Write, always_redraw, config, linear, smooth, LaggedStart, Indicate, DOWN, UP, LEFT, RIGHT, UR, DL
)

DATA = json.loads((Path(__file__).resolve().parent.parent / "docs/assets/data.json").read_text())

PAPER, INK, INK2, MUTED = "#fbf8f2", "#1d2433", "#5b6170", "#8d909a"
BLUE, BLUE_D, ORANGE, RED, GRAY, LINE = "#2a78d6", "#1c5cab", "#eb6834", "#e34948", "#b9b2a4", "#d9d2c3"
FONT = "AppleGothic"

config.background_color = PAPER
config.frame_height = 8
config.frame_width = 8 * 1280 / 1040


def T(s, size=28, color=INK, weight="NORMAL"):
    return Text(s, font=FONT, color=color, weight=weight).scale(size / 48)


class LorenzScene(Scene):
    def construct(self):
        lz = DATA["lorenz"]
        ax = Axes(x_range=[0, 1, 0.2], y_range=[0, 1, 0.2], x_length=6.4, y_length=5.6,
                  axis_config={"color": INK2, "stroke_width": 2, "include_ticks": True, "tick_size": 0.05},
                  tips=False).shift(LEFT * 0.75 + DOWN * 0.15)
        labels = VGroup()
        for v in [0, 0.2, 0.4, 0.6, 0.8, 1.0]:
            labels.add(T(f"{int(v * 100)}%", 18, MUTED).next_to(ax.c2p(v, 0), DOWN, buff=0.15))
            if v > 0:
                labels.add(T(f"{int(v * 100)}%", 18, MUTED).next_to(ax.c2p(0, v), LEFT, buff=0.15))
        xl = T("장서 누적 비율 (대출 적은 책부터)", 20, INK2).next_to(ax, DOWN, buff=0.55)
        yl = T("↑ 대출 누적 비율", 20, INK2).next_to(ax.c2p(0, 1), UP, buff=0.3).align_to(ax.c2p(0, 1), LEFT).shift(LEFT * 0.3)
        self.play(Create(ax), FadeIn(labels), FadeIn(xl), FadeIn(yl), run_time=1.2)

        diag = DashedLine(ax.c2p(0, 0), ax.c2p(1, 1), color=GRAY, stroke_width=3, dash_length=0.12)
        dl = T("모든 책이 똑같이 빌려진다면", 19, MUTED).rotate(math.atan2(5.6, 6.4)).move_to(ax.c2p(0.42, 0.5))
        self.play(Create(diag), FadeIn(dl), run_time=1.0)

        xs, ys = np.array(lz["x"]), np.array(lz["y"])
        t = ValueTracker(0.0)

        def curve_upto(p):
            k = max(2, int(p * (len(xs) - 1)) + 1)
            pts = [ax.c2p(x, y) for x, y in zip(xs[:k], ys[:k])]
            return pts

        curve = always_redraw(lambda: Line(ax.c2p(0, 0), ax.c2p(0, 0)).set_points_as_corners(curve_upto(t.get_value()))
                              .set_stroke(BLUE, 5))
        dot = always_redraw(lambda: Dot(curve_upto(t.get_value())[-1], color=BLUE_D, radius=0.07))
        self.add(curve, dot)

        # 1단계: 68%까지 평평 — 한 번도 안 빌려진 책
        self.play(t.animate.set_value(0.68), run_time=2.0, rate_func=linear)
        flat = T("여기까지 68%는\n대출 0회", 22, ORANGE, "BOLD").next_to(ax.c2p(0.5, 0), UP, buff=0.45)
        self.play(FadeIn(flat, shift=UP * 0.2), Indicate(dot, color=ORANGE), run_time=0.9)
        self.wait(0.4)
        # 2단계: 끝까지 급상승
        self.play(t.animate.set_value(1.0), run_time=2.2, rate_func=smooth)
        self.remove(dot)

        area_pts = [ax.c2p(x, y) for x, y in zip(xs, ys)] + [ax.c2p(1, 1), ax.c2p(0, 0)]
        area = Polygon(*[ax.c2p(x, y) for x, y in zip(xs, ys)], ax.c2p(0, 0), stroke_width=0)
        area.set_fill(BLUE, opacity=0.12)
        self.play(FadeIn(area), run_time=0.8)

        # 상위 10% 강조
        y90 = float(np.interp(0.9, xs, ys))
        v = DashedLine(ax.c2p(0.9, 0), ax.c2p(0.9, 1), color=INK2, stroke_width=2, dash_length=0.08)
        h1 = DashedLine(ax.c2p(0, y90), ax.c2p(0.9, y90), color=INK2, stroke_width=2, dash_length=0.08)
        bracket = Line(ax.c2p(1.03, y90), ax.c2p(1.03, 1), color=BLUE_D, stroke_width=6)
        top = T(f"상위 10%\n책이\n대출의\n{round(lz['top10'] * 100)}%", 24, BLUE_D, "BOLD").next_to(bracket, RIGHT, buff=0.2)
        self.play(Create(v), Create(h1), run_time=0.8)
        self.play(GrowFromCenter(bracket), FadeIn(top, shift=LEFT * 0.2), run_time=0.9)

        g = ValueTracker(0)
        gini = always_redraw(lambda: T(f"지니계수 {g.get_value():.2f}", 30, INK, "BOLD").to_corner(UR, buff=0.0)
                             .move_to(ax.c2p(0.27, 0.92)))
        self.add(gini)
        self.play(g.animate.set_value(lz["gini"]), run_time=1.6, rate_func=smooth)
        self.wait(2.5)


class ScatterScene(Scene):
    def construct(self):
        pts = DATA["scatter"]
        lo, hi = math.log10(0.01), math.log10(0.45)
        ax = Axes(x_range=[lo, hi, 1], y_range=[lo, hi, 1], x_length=6.2, y_length=5.6,
                  axis_config={"color": INK2, "stroke_width": 2, "include_ticks": False}, tips=False).shift(RIGHT * 0.35 + DOWN * 0.1)
        ticks = VGroup()
        for v in [0.01, 0.02, 0.05, 0.1, 0.2, 0.4]:
            lv = math.log10(v)
            ticks.add(T(f"{v * 100:g}%", 18, MUTED).next_to(ax.c2p(lv, lo), DOWN, buff=0.15))
            ticks.add(T(f"{v * 100:g}%", 18, MUTED).next_to(ax.c2p(lo, lv), LEFT, buff=0.15))
            ticks.add(Line(ax.c2p(lv, lo), ax.c2p(lv, hi), color=LINE, stroke_width=1))
            ticks.add(Line(ax.c2p(lo, lv), ax.c2p(hi, lv), color=LINE, stroke_width=1))
        xl = T("장서 비중 (로그 축)", 20, INK2).next_to(ax, DOWN, buff=0.55)
        yl = T("대출 비중 (로그 축)", 20, INK2).rotate(math.pi / 2).next_to(ax, LEFT, buff=0.85)
        self.play(FadeIn(ticks), Create(ax), FadeIn(xl), FadeIn(yl), run_time=1.2)

        diag = DashedLine(ax.c2p(lo, lo), ax.c2p(hi, hi), color=GRAY, stroke_width=3, dash_length=0.12)
        up = T("부족 (많이 빌려짐)", 20, BLUE, "BOLD").move_to(ax.c2p(math.log10(0.022), math.log10(0.25)))
        dn = T("과잉 (덜 빌려짐)", 20, RED, "BOLD").move_to(ax.c2p(math.log10(0.17), math.log10(0.016)))
        self.play(Create(diag), run_time=0.9)
        self.play(FadeIn(up), FadeIn(dn), run_time=0.6)

        # 1단계: '장서 비중만큼 빌려진다면'의 위치(대각선 위)에 점을 둔다
        dots, final, stems, names = [], [], [], []
        off = {"철학": (DOWN, 0.1), "역사": (RIGHT, 0.12), "기술과학": (RIGHT, 0.12), "자연과학": (LEFT, 0.12),
               "언어": (LEFT, 0.12), "예술": (RIGHT, 0.12), "종교": (RIGHT, 0.12), "사회과학": (RIGHT, 0.12),
               "문학": (LEFT, 0.12), "총류": (LEFT, 0.12), "미분류": (LEFT, 0.12)}
        for p in pts:
            col = GRAY if p["name"] == "미분류" else (BLUE if p["index"] >= 1 else RED)
            sx = math.log10(p["stock"])
            d = Dot(ax.c2p(sx, sx), radius=0.09, color=col)
            dots.append(d)
            final.append(ax.c2p(sx, math.log10(p["loan"])))
            stems.append((ax.c2p(sx, sx), ax.c2p(sx, math.log10(p["loan"])), col))
            direction, buff = off.get(p["name"], (RIGHT, 0.12))
            names.append((p["name"], direction, buff, col))
        cap = T("모든 분야가 장서 비중만큼 빌려진다면…", 22, INK2).to_edge(UP, buff=0.25)
        self.play(FadeIn(cap), LaggedStart(*[GrowFromCenter(d) for d in dots], lag_ratio=0.08), run_time=1.6)
        self.wait(0.4)

        # 2단계: 실제 대출 비중으로 이동 (줄기로 차이를 남김)
        cap2 = T("실제 대출 비중으로 이동하면", 22, INK, "BOLD").to_edge(UP, buff=0.25)
        lines = [Line(a, a, color=c, stroke_width=3) for a, b, c in stems]
        self.add(*lines)
        anims = []
        for d, f, ln, (a, b, c) in zip(dots, final, lines, stems):
            anims.append(d.animate.move_to(f))
            anims.append(ln.animate.put_start_and_end_on(a, b))
        self.play(FadeOut_(cap), FadeIn(cap2), *anims, run_time=2.2, rate_func=smooth)

        labels = VGroup(*[T(n, 18, INK).next_to(d, dr, buff=bf) for d, (n, dr, bf, c) in zip(dots, names)])
        self.play(LaggedStart(*[FadeIn(l) for l in labels], lag_ratio=0.06), run_time=1.2)
        self.wait(3)


def FadeOut_(m):
    from manim import FadeOut
    return FadeOut(m)
