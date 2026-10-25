"""슬라이드 덱용 집계 데이터(JSON)와 matplotlib 차트(SVG)를 만든다.

사용법: python3 analysis/make_deck_assets.py <CSV 경로> <출력 폴더>
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mtick
from matplotlib.colors import LinearSegmentedColormap

CSV, OUT = sys.argv[1], Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
REF = pd.Timestamp("2026-09-30")

# ---------- 공통 스타일 (덱 색상과 맞춤) ----------
PAPER, INK, INK2, GRID = "#fbf8f2", "#1d2433", "#5b6170", "#e7e2d8"
BLUE, ORANGE, GRAY = "#2a78d6", "#eb6834", "#c9c3b6"
plt.rcParams.update({
    "font.family": "AppleGothic", "axes.unicode_minus": False, "svg.fonttype": "none",
    "figure.facecolor": "none", "axes.facecolor": "none",
    "axes.edgecolor": "#cfc8ba", "axes.labelcolor": INK2, "xtick.color": INK2, "ytick.color": INK2,
    "text.color": INK, "axes.spines.top": False, "axes.spines.right": False,
    "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.8, "axes.axisbelow": True,
    "font.size": 12,
})

# ---------- 로드 & 전처리 ----------
df = pd.read_csv(CSV, encoding="utf-8-sig", dtype=str)
df = df.loc[:, ~df.columns.str.startswith("Unnamed")]
df["L"] = pd.to_numeric(df["대출건수"], errors="coerce").fillna(0).astype(int)
df["reg"] = pd.to_datetime(df["등록일자"], errors="coerce")
df["pub"] = pd.to_numeric(df["발행년도"].str.extract(r"(\d{4})")[0], errors="coerce")
df.loc[(df["pub"] < 1900) | (df["pub"] > 2026), "pub"] = np.nan
df["months"] = ((REF - df["reg"]).dt.days / 30.44).clip(lower=0.5)
df["ml"] = df["L"] / df["months"]
KDC = {"0": "총류", "1": "철학", "2": "종교", "3": "사회과학", "4": "자연과학",
       "5": "기술과학", "6": "예술", "7": "언어", "8": "문학", "9": "역사"}
df["subj"] = df["주제분류번호"].str.extract(r"^\s*(\d)")[0].map(KDC).fillna("미분류")
READER = {"0": "교양", "1": "실용", "4": "청소년", "7": "아동", "9": "전문"}
df["reader"] = df["부가기호"].str.strip().str[:1].map(READER).fillna("기타·미상")
df["key"] = df["ISBN"].fillna("") + "|" + df["도서명"].fillna("") + "|" + df["권"].fillna("")
N, TOT = len(df), int(df["L"].sum())
D = {}

# KPI
D["kpi"] = {
    "books": N, "loans": TOT, "zero": int((df["L"] == 0).sum()),
    "zero_rate": float((df["L"] == 0).mean()), "mean": float(df["L"].mean()),
    "reg_min": str(df["reg"].min().date()), "reg_max": str(df["reg"].max().date()),
    "titles": int(df["key"].nunique()), "max": int(df["L"].max()),
}

# 결측률
miss = raw_miss = df[["도서명", "저자", "출판사", "발행년도", "ISBN", "세트 ISBN", "부가기호", "권", "주제분류번호"]].isna().mean()
D["missing"] = [{"col": k, "rate": float(v)} for k, v in miss.sort_values(ascending=False).items()]

# 로렌츠 곡선
s = np.sort(df["L"].values)
cum = np.cumsum(s) / s.sum()
x = np.arange(1, len(s) + 1) / len(s)
trap = getattr(np, "trapezoid", None) or np.trapz
gini = float(1 - 2 * trap(cum, x))
idx = np.linspace(0, len(s) - 1, 201).astype(int)
D["lorenz"] = {"x": x[idx].round(4).tolist(), "y": cum[idx].round(4).tolist(), "gini": gini,
               "top10": float(1 - np.interp(0.9, x, cum)), "top20": float(1 - np.interp(0.8, x, cum))}

# 대출 구간
bins = [-1, 0, 2, 5, 10, 20, 50, 10000]
labels = ["0회", "1~2회", "3~5회", "6~10회", "11~20회", "21~50회", "51회+"]
band = pd.cut(df["L"], bins=bins, labels=labels)
bt = df.groupby(band, observed=False)["L"].agg(["size", "sum"])
D["bands"] = [{"band": b, "stock": float(r["size"] / N), "loans": float(r["sum"] / TOT)} for b, r in bt.iterrows()]


def summarize(col):
    g = df.groupby(col).agg(n=("L", "size"), s=("L", "sum"), mean=("L", "mean"), ml=("ml", "mean"),
                            zero=("L", lambda v: (v == 0).mean()))
    g["stock"] = g["n"] / N
    g["loan"] = g["s"] / TOT
    g["index"] = g["loan"] / g["stock"]
    return g


sj = summarize("subj").sort_values("index", ascending=False)
D["subjects"] = [{"name": k, "stock": float(r["stock"]), "loan": float(r["loan"]), "index": float(r["index"]),
                  "mean": float(r["mean"]), "zero": float(r["zero"]), "n": int(r["n"])} for k, r in sj.iterrows()]
rd = summarize("reader").sort_values("n", ascending=False)
D["readers"] = [{"name": k, "stock": float(r["stock"]), "loan": float(r["loan"]), "index": float(r["index"]),
                 "mean": float(r["mean"]), "zero": float(r["zero"])} for k, r in rd.iterrows()]

# 신간성 (6개월 이상 보유)
d = df[(df["months"] >= 6)].copy()
d["gap"] = d["reg"].dt.year - d["pub"]
d = d[d["gap"].between(0, 60)]
d["g"] = pd.cut(d["gap"], [-1, 0, 1, 2, 5, 10, 60], labels=["같은 해", "1년", "2년", "3~5년", "6~10년", "11년+"])
fr = d.groupby("g", observed=True).agg(ml=("ml", "mean"), zero=("L", lambda v: (v == 0).mean()), n=("L", "size"))
D["fresh"] = [{"g": k, "ml": float(r["ml"]), "zero": float(r["zero"]), "n": int(r["n"])} for k, r in fr.iterrows()]

# 등록 코호트
co = df.groupby(df["reg"].dt.year).agg(n=("L", "size"), ml=("ml", "mean"), zero=("L", lambda v: (v == 0).mean()))
D["cohort"] = [{"year": int(k), "n": int(r["n"]), "ml": float(r["ml"]), "zero": float(r["zero"])} for k, r in co.iterrows()]

# 장기 미대출
old = df[df["months"] >= 24]
dead = old[old["L"] == 0]
D["dead"] = {"old": len(old), "dead": len(dead), "rate": len(dead) / len(old),
             "pre2010_dead": float((dead["pub"] < 2010).mean()),
             "pre2010_alive": float((old.loc[old["L"] > 0, "pub"] < 2010).mean())}

# 복본
book = df.groupby("key").agg(n=("L", "size"), s=("L", "sum"), ml=("ml", "sum"))
book["per"] = book["s"] / book["n"]
book["c"] = pd.cut(book["n"], [0, 1, 2, 3, 5, 10000], labels=["1권", "2권", "3권", "4~5권", "6권+"])
cp = book.groupby("c", observed=True).agg(titles=("s", "size"), per=("per", "mean"), per_title=("s", "mean"),
                                          zero=("s", lambda v: (v == 0).mean()))
D["copies"] = [{"c": k, "titles": int(r["titles"]), "per": float(r["per"]), "per_title": float(r["per_title"]),
                "zero": float(r["zero"])} for k, r in cp.iterrows()]

# 대기 압력: 1권인데 월 1회 이상 대출
hot = book[(book["n"] == 1) & (book["ml"] >= 1)]
D["waiting"] = {"count": int(len(hot))}
first = df.drop_duplicates("key").set_index("key")
ex = hot.sort_values("ml", ascending=False).head(6)
D["waiting"]["examples"] = [{"title": str(first.loc[k, "도서명"]), "ml": float(r["ml"])} for k, r in ex.iterrows()]

# 번외: 제목 키워드
base = df["ml"].mean()
t = df["도서명"].fillna("")
kws = {"떡집": "떡집", "편의점": "편의점", "MBTI": "MBTI", "탐정·추리": "탐정|추리", "챗GPT": "챗GPT|ChatGPT|생성형",
       "공룡": "공룡", "주식": "주식", "행복": "행복", "코로나": "코로나", "다이어트": "다이어트"}
D["keywords"] = [{"kw": k, "ratio": float(df.loc[t.str.contains(p), "ml"].mean() / base),
                  "n": int(t.str.contains(p).sum())} for k, p in kws.items()]
# 번외: 시리즈 이탈 (흔한남매 본편)
hs = df[t.str.match(r"^흔한남매\s*\d+\s*\.?$")].copy()
hs["vol"] = hs["도서명"].str.extract(r"(\d+)")[0].astype(int)
hv = hs[hs["vol"] <= 12].groupby("vol")["L"].mean()
D["series"] = [{"vol": int(k), "mean": float(v)} for k, v in hv.items()]

# 수요-공급 산점도용 (대분류)
D["scatter"] = D["subjects"]

(OUT / "data.json").write_text(json.dumps(D, ensure_ascii=False, indent=1))

# ---------- matplotlib 차트 ----------
# 1) 주제 × 이용대상 히트맵
cols = ["아동", "청소년", "교양", "실용", "전문"]
rows = ["문학", "자연과학", "기술과학", "사회과학", "역사", "철학", "언어", "예술", "종교", "총류"]
cnt = pd.crosstab(df["subj"], df["reader"])
avg = df.pivot_table(index="subj", columns="reader", values="L", aggfunc="mean")
avg = avg.loc[rows, cols].where(cnt.loc[rows, cols] >= 300)
cmap = LinearSegmentedColormap.from_list("b", ["#f1f6fd", "#9ec5f4", "#3987e5", "#1c5cab", "#0d366b"])
fig, ax = plt.subplots(figsize=(7.2, 6.2))
im = ax.imshow(avg.values, cmap=cmap, aspect="auto")
ax.set_xticks(range(len(cols)), cols, fontsize=13)
ax.set_yticks(range(len(rows)), rows, fontsize=13)
ax.grid(False)
for sp in ax.spines.values():
    sp.set_visible(False)
ax.tick_params(length=0)
vmax = np.nanmax(avg.values)
for i in range(len(rows)):
    for j in range(len(cols)):
        v = avg.values[i, j]
        ax.text(j, i, "–" if np.isnan(v) else f"{v:.1f}", ha="center", va="center", fontsize=12,
                color=("white" if (not np.isnan(v) and v > vmax * 0.5) else INK) if not np.isnan(v) else GRAY)
cb = plt.colorbar(im, ax=ax, shrink=0.75, pad=0.03)
cb.outline.set_visible(False)
cb.set_label("권당 평균 누적 대출", color=INK2)
plt.tight_layout()
fig.savefig(OUT / "heatmap.svg", transparent=True)
plt.close(fig)

# 2) 월별 신규 등록
monthly = df.set_index("reg").resample("MS").size()
fig, ax = plt.subplots(figsize=(11, 3.6))
colors = [ORANGE if (d.year == 2020) else BLUE for d in monthly.index]
ax.bar(monthly.index, monthly.values, width=24, color=colors)
ax.yaxis.set_major_formatter(mtick.FuncFormatter(lambda v, _: f"{v/10000:.0f}만" if v else "0"))
ax.grid(axis="x", visible=False)
ax.set_ylabel("신규 등록 (권)")
peak = monthly.idxmax()
ax.annotate(f"{peak:%Y.%m} 개관 직전\n{monthly.max():,}권", xy=(peak, monthly.max()),
            xytext=(peak + pd.Timedelta(days=200), monthly.max() * 0.85), color=INK2, fontsize=11,
            arrowprops=dict(arrowstyle="->", color=INK2))
plt.tight_layout()
fig.savefig(OUT / "monthly.svg", transparent=True)
plt.close(fig)

# 3) 대출건수 분포 (로그)
fig, ax = plt.subplots(figsize=(6.4, 3.8))
b = np.arange(0, df["L"].max() + 6, 5)
ax.hist(df["L"], bins=b, color=BLUE, edgecolor=PAPER, linewidth=0.8)
ax.set_yscale("log")
ax.yaxis.set_major_formatter(mtick.FuncFormatter(lambda v, _: f"{v:,.0f}"))
ax.set_xlabel("권당 누적 대출건수")
ax.set_ylabel("장서 수 (로그)")
plt.tight_layout()
fig.savefig(OUT / "hist.svg", transparent=True)
plt.close(fig)

print(json.dumps(D["kpi"], ensure_ascii=False))
print("gini", round(gini, 3), "waiting", D["waiting"]["count"])
print("series", D["series"])

# file:// 로 열어도 동작하도록 JS 버전도 저장
(OUT / "data.js").write_text("window.DECK = " + json.dumps(D, ensure_ascii=False) + ";\n")
