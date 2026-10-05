# LexiLoop

Ứng dụng web học từ vựng tiếng Anh bằng flashcard, quiz và trò chơi, xếp lịch ôn tập theo thuật toán lặp lại ngắt quãng (SM-2). Ứng dụng chạy hoàn toàn trên máy cá nhân, dữ liệu lưu bằng SQLite.

## Tính năng

- **Quản lý từ vựng:** thêm, sửa, xóa, tìm kiếm, lọc theo trạng thái/tag/deck, sắp xếp và phân trang.
- **Deck:** chia từ vựng thành nhiều bộ thẻ để học riêng.
- **Flashcard:** thẻ lật 3D, phát âm bằng file audio hoặc Web Speech API, có ảnh minh họa.
- **Lịch ôn SRS:** bốn mức đánh giá Again, Hard, Good, Easy; ba chế độ học: ôn đến hạn, học từ mới, ôn ngẫu nhiên.
- **Quiz:** chọn nghĩa, gõ từ, điền vào câu (câu ví dụ có thể tạo bằng Gemini) và nghe viết, có gợi ý từng chữ cái.
- **Trò chơi:** ghép cặp từ–nghĩa, lật thẻ trí nhớ, Khối hộp và Blast.
- **Nhập/xuất:** nhập từ CSV, XLSX, PDF (có xem trước và sửa trước khi nhập); xuất CSV, XLSX, JSON.
- **Tìm ảnh bằng AI:** Gemini gợi ý từ khóa, ảnh lấy từ Wikimedia Commons kèm nguồn và giấy phép.
- **Tiến độ:** dashboard, chuỗi ngày học, huy hiệu, lời nhắc ôn tập.
- **Nhiều tài khoản:** mỗi tài khoản có thư viện, tiến độ, cài đặt và ảnh riêng.
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
│   │   └── services/        # SRS, nhập/xuất file, Gemini, tìm ảnh
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
| `UPLOAD_DIR` | `./data/uploads` | Thư mục lưu ảnh tải lên |
| `TZ` |  | Múi giờ, ví dụ `Asia/Ho_Chi_Minh` |
| `ACCESS_TOKEN_TTL_MINUTES` | `15` | Thời gian sống của access token |
| `REFRESH_TOKEN_TTL_DAYS` | `7` | Thời gian sống của refresh token |
| `AUTH_TOKEN_SECRET` |  | Khóa ký access token (≥ 32 ký tự). Nếu bỏ trống, mỗi lần khởi động server sẽ tạo khóa tạm mới |
| `GEMINI_API_KEY` |  | Khóa Gemini cho quiz điền vào câu và tìm ảnh bằng AI |
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
- **Tìm ảnh bằng AI:** trong form thêm/sửa từ, chọn **Tìm ảnh bằng AI**. Gemini gợi ý từ khóa theo nghĩa, ảnh lấy từ Wikimedia Commons. Ảnh được lưu dưới dạng URL, kèm nguồn, tác giả và giấy phép.

Chỉ id, từ và nghĩa của từ cần xử lý được gửi tới Google. Việc gọi Gemini có thể phát sinh phí hoặc giới hạn lượt dùng.

## Phím tắt khi học

| Phím | Tác dụng |
| --- | --- |
| `Space` | Lật flashcard |
| `1` / `2` / `3` / `4` | Again / Hard / Good / Easy (sau khi đã lật thẻ) |
| `Enter` | Xác nhận câu trả lời quiz, bắt đầu/chơi lại trò chơi |

## Dữ liệu và sao lưu

- Database chính: `backend/data/lexiloop.db`
- Database của từng tài khoản: `backend/data/accounts/`
- Ảnh tải lên: `backend/data/uploads/`

Thư mục `backend/data/` và file `backend/.env` đã nằm trong `.gitignore` nên không bị đẩy lên GitHub. Để sao lưu, dùng **Xuất JSON backup** trong trang Cài đặt, hoặc sao chép thư mục `backend/data/` khi ứng dụng đã dừng.

## Đóng góp

1. Fork repo và tạo nhánh mới.
2. Chạy `npm run typecheck` và `npm test` trước khi gửi pull request.
3. Mô tả rõ thay đổi trong pull request.