# 부산도서관 장서–대출 데이터 기반 도서관 운영 제안

**데이터리터러시의 이해** 중간대체 과제: 분석 주제와 데이터 분석 계획 (문헌정보학과 202406224 홍현아)

- **슬라이드 덱**: https://hhonge1234-create.github.io/busan-library-analysis/ (←/→ 또는 스페이스로 넘기기, F = 전체화면)
- **예비 분석 노트북**: [`부산도서관_대출분석.ipynb`](부산도서관_대출분석.ipynb)

## 데이터
[도서관 정보나루](https://www.data4library.kr)(국립중앙도서관 운영)에서 내려받은 **부산도서관 장서/대출 데이터** (2026년 9월 기준, 659,791권 × 13개 컬럼). 원본 CSV는 용량 때문에 레포에 포함하지 않았습니다.

## 구성
| 경로 | 내용 |
|---|---|
| `docs/` | 슬라이드 덱 (GitHub Pages) — anime.js 애니메이션, manim 영상, matplotlib 차트 |
| `docs/PLAN.md` | 덱 제작 계획과 검증 절차 |
| `analysis/make_deck_assets.py` | CSV → 덱용 집계 데이터(`data.json`)와 matplotlib SVG |
| `analysis/manim_scenes.py` | 로렌츠 곡선 · 수요–공급 산점도 manim 애니메이션 |
| `부산도서관_대출분석.ipynb` | 예비 탐색 분석 |

## 다시 만들기
```bash
python3 analysis/make_deck_assets.py "<CSV 경로>" docs/assets
manim render -r 1280,1040 --fps 30 analysis/manim_scenes.py LorenzScene ScatterScene
cp media/videos/manim_scenes/1040p30/{LorenzScene,ScatterScene}.mp4 docs/assets/  # lorenz.mp4, scatter.mp4로 이름 변경
```
