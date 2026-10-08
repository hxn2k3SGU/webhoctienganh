# LexiLoop

Ứng dụng web học từ vựng tiếng Anh bằng flashcard, quiz và trò chơi, xếp lịch ôn tập theo thuật toán lặp lại ngắt quãng (SM-2). Ứng dụng chạy hoàn toàn trên máy cá nhân, dữ liệu lưu bằng SQLite.

## Tính năng

- **Quản lý từ vựng:** thêm, sửa, xóa, tìm kiếm, lọc theo trạng thái/tag/deck, sắp xếp và phân trang.
- **Deck:** chia từ vựng thành nhiều bộ thẻ để học riêng.
- **Flashcard:** thẻ lật 3D, phát âm bằng file audio hoặc Web Speech API.
- **Lịch ôn SRS:** bốn mức đánh giá Again, Hard, Good, Easy; ba chế độ học: ôn đến hạn, học từ mới, ôn ngẫu nhiên.
- **Quiz:** chọn nghĩa, gõ từ, điền vào câu (câu ví dụ có thể tạo bằng Gemini) và nghe viết, có gợi ý từng chữ cái.
- **TOEIC:** luyện 7 Part với 60 câu mẫu chính thức IIBC/ETS; lưu đáp án, đánh dấu, chấm bài và lịch sử riêng từng tài khoản. Hỗ trợ nhập đề đủ 200 câu để thi thử có bấm giờ.
- **Trò chơi:** ghép cặp từ–nghĩa, lật thẻ trí nhớ, Khối hộp và Blast.
- **Nhập/xuất:** nhập từ CSV, XLSX, PDF (có xem trước và sửa trước khi nhập); xuất CSV, XLSX, JSON.
- **Tiến độ:** dashboard, chuỗi ngày học, huy hiệu, lời nhắc ôn tập.
- **Nhiều tài khoản:** mỗi tài khoản có thư viện, tiến độ, cài đặt riêng.
- **Giao diện:** responsive, chế độ sáng/tối/theo hệ thống.

## Công nghệ

| Phần | Công nghệ |
| --- | --- |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, TanStack Query, React Router, React Hook Form, Recharts |
| Backend | Node.js, Express, TypeScript, better-sqlite3, Argon2, Zod, Multer |
| Dùng chung | `packages/shared`: các schema Zod dùng cho cả kiểm tra dữ liệu |
| Test | Vitest, Testing Library, Supertest |

## Cấu trúc thư mục

```text
.
├── backend/                 # API Express + SQLite
│   ├── src/
│   │   ├── index.ts         # Điểm khởi động server
│   │   ├── app.ts           # Cấu hình Express, middleware, route
│   │   ├── auth.ts          # Đăng ký, đăng nhập, access/refresh token
│   │   ├── config.ts        # Đọc biến môi trường
│   │   ├── workspaces.ts    # Database riêng cho từng tài khoản
│   │   ├── db/              # Kết nối, migration, seed
│   │   ├── middleware/      # Bảo mật, xử lý lỗi
│   │   ├── routes/          # Các nhóm API
│   │   └── services/        # SRS, nhập/xuất file, Gemini
│   ├── migrations/          # File SQL tạo/cập nhật schema
│   ├── seeds/words.csv      # 100 từ mẫu
│   └── tests/
├── frontend/                # Giao diện React + Vite
│   ├── src/
│   │   ├── api/client.ts    # Gọi API, tự refresh token
│   │   ├── auth/            # Trạng thái đăng nhập, route bảo vệ
│   │   ├── components/      # Component giao diện
│   │   ├── pages/           # Các trang
│   │   ├── hooks/           # Custom hooks
│   │   └── utils/           # Hàm tiện ích (quiz, trò chơi, âm thanh)
│   └── tests/
├── packages/shared/         # Schema Zod dùng chung
├── examples/                # File mẫu để thử chức năng nhập
├── .env.example             # Mẫu cấu hình
└── package.json             # npm workspaces và các lệnh chính
```

## Yêu cầu

- Node.js 20 trở lên
- npm 10 trở lên

`better-sqlite3` và `argon2` là native module. Nếu `npm install` lỗi trên Windows, hãy dùng bản Node.js LTS và cài [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) với workload **Desktop development with C++**.

## Chạy nhanh trên Windows

Bấm đúp file **`Chay-Web.bat`** trong thư mục dự án. File sẽ cài thư viện nếu chưa có (cần Internet ở lần đầu), tạo `backend/.env` nếu chưa tồn tại, chạy backend cùng database SQLite và frontend, rồi tự mở **Microsoft Edge** tại [http://localhost:5173](http://localhost:5173) khi frontend sẵn sàng. Máy cần cài Node.js 20 trở lên, npm 10 trở lên và Microsoft Edge.

Giữ cửa sổ lệnh mở khi sử dụng. Để dừng, nhấn **Ctrl+C** trong cửa sổ đó và chọn **Y** nếu được hỏi. Dữ liệu đã có được giữ lại; database tự cập nhật cấu trúc khi khởi động. Nếu cổng 3001 hoặc 5173 đang được sử dụng, hãy dừng phiên web cũ trước khi chạy lại.

Để chạy từ Desktop, tạo **shortcut** trỏ tới `Chay-Web.bat` (chuột phải vào file → **Send to → Desktop (create shortcut)**). Giữ file `.bat` gốc trong thư mục dự án; không copy riêng file này ra Desktop vì nó cần các file bên cạnh để khởi động.

## Cài đặt và chạy

1. Clone project và cài thư viện:

   ```bash
   git clone https://github.com/<tên-tài-khoản>/<tên-repo>.git
   cd <tên-repo>
   npm install
   ```

2. Tạo file cấu hình cho backend từ file mẫu:

   ```bash
   # macOS / Linux
   cp .env.example backend/.env

   # Windows PowerShell
   Copy-Item .env.example backend/.env
   ```

   Mở `backend/.env` và đặt `AUTH_TOKEN_SECRET` là một chuỗi ngẫu nhiên dài ít nhất 32 ký tự. Có thể tạo bằng lệnh:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. (Tùy chọn) Nạp 100 từ mẫu:

   ```bash
   npm run db:seed
   ```

4. Chạy ứng dụng:

   ```bash
   npm run dev
   ```

   Mở [http://localhost:5173](http://localhost:5173). API chạy tại `http://localhost:3001`. Lần đầu mở, hãy đăng ký một tài khoản.

Server tự chạy migration mỗi khi khởi động.

## Các lệnh

| Lệnh | Tác dụng |
| --- | --- |
| `npm run dev` | Chạy cả backend và frontend |
| `npm run typecheck` | Kiểm tra TypeScript |
| `npm test` | Chạy toàn bộ test |
| `npm run db:migrate` | Áp dụng migration còn thiếu |
| `npm run db:seed` | Nạp từ mẫu, không nhân đôi từ đã có |
| `npm run db:reset` | **Xóa database**, tạo lại và nạp từ mẫu |

> Không chạy `npm run db:reset` nếu bạn muốn giữ từ vựng và tiến độ học.

## Cấu hình

Các biến đặt trong `backend/.env`:

| Biến | Mặc định | Mô tả |
| --- | --- | --- |
| `PORT` | `3001` | Cổng của API |
| `DEV_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Các origin được phép gọi API |
| `DATABASE_PATH` | `./data/lexiloop.db` | File database chính (tính từ thư mục `backend`) |
| `UPLOAD_DIR` | `./data/uploads` | Thư mục phục vụ file âm thanh cục bộ đã có |
| `TZ` |  | Múi giờ, ví dụ `Asia/Ho_Chi_Minh` |
| `ACCESS_TOKEN_TTL_MINUTES` | `15` | Thời gian sống của access token |
| `REFRESH_TOKEN_TTL_DAYS` | `7` | Thời gian sống của refresh token |
| `AUTH_TOKEN_SECRET` |  | Khóa ký access token (≥ 32 ký tự). Nếu bỏ trống, mỗi lần khởi động server sẽ tạo khóa tạm mới |
| `GEMINI_API_KEY` |  | Khóa Gemini cho quiz điền vào câu |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Model Gemini sử dụng |

## Xác thực

- Mật khẩu được băm bằng Argon2id.
- **Access token** sống 15 phút, là token có chữ ký HMAC lưu trong cookie `httpOnly`.
- **Refresh token** sống 7 ngày, chỉ lưu bản băm SHA-256 trong bảng `refresh_tokens`. Mỗi lần dùng, refresh token được xoay vòng (xóa cái cũ, cấp cái mới).
- Frontend tự refresh trước khi access token hết hạn và khi API trả lỗi 401.
- Các request thay đổi dữ liệu được bảo vệ bằng CSRF token và kiểm tra origin.
- Tên đăng nhập dài 3–64 ký tự (chữ không dấu, số, `.`, `_`, `-`); mật khẩu dài 12–256 ký tự.

## Nhập từ vựng

Trong trang **Từ vựng**, chọn **Nhập file**, chọn file rồi xem trước và sửa trước khi nhập. Có thể chọn bỏ qua hoặc cập nhật từ bị trùng.

File CSV/XLSX có thể dùng các cột sau (file mẫu: `examples/vocabulary-template.csv`):

| Cột | Bắt buộc | Mô tả |
| --- | --- | --- |
| `word` | Có | Từ hoặc cụm từ tiếng Anh |
| `meaning` | Có | Nghĩa tiếng Việt |
| `pronunciation` | Không | Phiên âm |
| `example_sentence` | Không | Câu ví dụ |
| `part_of_speech` | Không | Loại từ |
| `synonyms` | Không | Từ đồng nghĩa, cách nhau bởi `|` |
| `tag` | Không | Chủ đề, mặc định `General` |

File PDF phải có lớp văn bản (bôi đen và sao chép được), tối đa 10 MB; PDF scan chỉ có hình ảnh chưa được hỗ trợ. Hỗ trợ bảng có header như trên hoặc danh sách dạng `word - meaning`, `word: meaning`. File mẫu: `examples/vocabulary-template.pdf`.

## Tính năng dùng Gemini

Cần đặt `GEMINI_API_KEY` trong `backend/.env` và có kết nối Internet. Khóa chỉ dùng ở backend, không gửi xuống trình duyệt.

- **Quiz điền vào câu:** ưu tiên câu ví dụ có sẵn; chỉ gọi Gemini cho từ chưa có câu hợp lệ (tối đa 5 từ mỗi lượt, 2 lượt song song, khoảng 20 giây cho mỗi quiz). Câu tạo được chỉ lưu vào từ đang trống ví dụ, không ghi đè ví dụ bạn đã nhập.

Chỉ id, từ và nghĩa của từ cần xử lý được gửi tới Google. Việc gọi Gemini có thể phát sinh phí hoặc giới hạn lượt dùng.

## Luyện Và Thi Thử TOEIC

Thư viện TOEIC Building đã tải trên máy có **55 đề ETS / 11.000 câu**. Mở mục **TOEIC** để chọn đề và dùng hình/audio cục bộ. Có **49 đề thi thử đầy đủ**; 6 đề còn thiếu nội dung hoặc media ngay tại nguồn nên chỉ mở luyện tập và hiển thị cảnh báo. Dữ liệu nằm trong `backend/data/toeicbuilding/` (không đưa vào Git); cần sao chép thư mục này khi chuyển web sang máy khác. Xem [hướng dẫn và báo cáo tải](imports/toeicbuilding/README.md).

Chọn **TOEIC** trên thanh điều hướng. Bộ mẫu tích hợp có 60 câu, giữ nguyên số câu của [nguồn chính thức IIBC](https://www.iibc-global.org/english/toeic/test/lr/about/format.html). Nút **Mở đề và audio gốc** mở trang nguồn trong tab riêng; chọn đáp án trên LexiLoop. Nội dung đề, hình và audio không được sao chép vào dự án. Có thể tham khảo thêm [PDF mẫu ETS](https://www.ets.org/pdfs/toeic/toeic-listening-reading-sample-test.pdf). Đáp án mẫu được kiểm tra ngày 07/10/2026. Trang nguồn có đáp án; hãy xem sau khi nộp bài.

- **Luyện tập:** chọn toàn bộ mẫu hoặc một Part, không giới hạn thời gian hoặc đặt đồng hồ. Mỗi câu trả lời được lưu trên server; có thể đóng trang rồi tiếp tục từ lịch sử. Lượt có bấm giờ vẫn tính thời gian khi đóng trang.
- **Thi thử đầy đủ:** cần đề đủ 200 câu theo thứ tự Part 1–7: 6, 25, 39, 30, 30, 16, 54 câu. Listening tối thiểu 45 phút, kéo dài theo audio nguồn nếu cần; Reading 75 phút. Server khóa phần thi ngoài thời gian và chấm bài khi hết giờ. Audio dùng file HTTPS hoặc media cục bộ của thư viện. Nếu tải lại trang, nhấn **Phát / khôi phục audio** để nghe tiếp theo thời gian thi.
- **Nguồn đề:** mẫu 60 câu không phải bài thi đầy đủ. Đề JSON nhập cần có nguồn, quyền sử dụng, nội dung và đáp án; hệ thống kiểm tra cấu trúc, không xác nhận chất lượng hay gắn nhãn đề chính thức cho nội dung nhập. Tải hướng dẫn tại `frontend/public/toeic-import-guide.json` hoặc trong mục **Thêm đề đủ 200 câu**. Hướng dẫn không chứa đề dùng để thi.
- **Chấm điểm:** hiển thị Listening /495, Reading /495, tổng /990, số câu đúng/sai/bỏ trống, tỷ lệ đúng, thời gian làm bài và kết quả từng Part. Điểm quy đổi là **tham khảo theo bảng PREP**, không phải điểm chứng chỉ ETS hoặc bảng riêng của TOEIC Building (trang nguồn tính điểm trên máy chủ). Chỉ quy đổi kỹ năng có đủ 100 câu; bài luyện ngắn không suy rộng điểm. Điểm được lưu khi nộp/hết giờ và hiển thị trong lịch sử, kể cả các kết quả cũ.
- **Dữ liệu:** đề nhập và lượt thi lưu trong `toeic_tests`, `toeic_attempts` ở database của tài khoản; độc lập với từ vựng và lịch sử ôn flashcard. Hình của đề TOEIC chỉ dùng cho câu hỏi TOEIC, không khôi phục chức năng ảnh flashcard.

## Phím tắt khi học

| Phím | Tác dụng |
| --- | --- |
| `Space` | Lật flashcard |
| `1` / `2` / `3` / `4` | Again / Hard / Good / Easy (sau khi đã lật thẻ) |
| `Enter` | Xác nhận câu trả lời quiz, bắt đầu/chơi lại trò chơi |

## Dữ liệu và sao lưu

- Database chính: `backend/data/lexiloop.db`
- Database của từng tài khoản: `backend/data/accounts/`
- File âm thanh cục bộ (nếu có): `backend/data/uploads/`

Thư mục `backend/data/` và file `backend/.env` đã nằm trong `.gitignore` nên không bị đẩy lên GitHub. Để sao lưu, dùng **Xuất JSON backup** trong trang Cài đặt, hoặc sao chép thư mục `backend/data/` khi ứng dụng đã dừng.

## Đóng góp

1. Fork repo và tạo nhánh mới.
2. Chạy `npm run typecheck` và `npm test` trước khi gửi pull request.
3. Mô tả rõ thay đổi trong pull request.
