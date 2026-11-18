# Ngàn lời yêu

## Cấu trúc dự án

```text
rain-love-star--flowers-2d5e3.asia-southeast1.hosted.app/
├── index.html
├── script.js
├── css/
│   ├── style.css
│   └── legacy.css
├── assets/
│   ├── orbit/
│   │   ├── orbit-ring-cosmic-soft-01.svg
│   │   └── traitimnew.svg
│   ├── rain/
│   └── vendor/
│       └── three-r128.min.js
└── photos/
```

## Chạy thử

Mở thư mục bằng VS Code, chạy Live Server tại `index.html`.
Hoặc chạy `python -m http.server 8000` trong thư mục dự án rồi mở
`http://localhost:8000`.

## Ghi chú

- Đã bỏ liên kết Google Fonts để phần font bổ sung sau.
- Ảnh cá nhân và các ảnh gốc chưa được thêm; thư mục `photos/` để sẵn.
- JavaScript hiện vẫn được giữ trong `script.js` để tránh tách nhầm các phần phụ thuộc.
- `three-r128.min.js` là thư viện Three.js đi kèm dự án.
