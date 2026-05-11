# Quy định Khoảnh khắc (Story) - Zalo Mobile 2026

Tài liệu này quy định các thông số kỹ thuật và logic hoạt động của tính năng Story theo tiêu chuẩn mới nhất.

## 1. Thời lượng hiển thị (Playback Duration)

Hệ thống tự động nhận diện loại nội dung để điều chỉnh thanh tiến trình:

*   **Ảnh tĩnh (Photo) & Văn bản (Text):** Hiển thị cố định trong **7 giây**.
*   **Video:** Hiển thị theo thời lượng thực tế của file, nhưng tối đa không quá **30 giây**.
*   **Video lặp (Loop):** Hiển thị trong **2 giây** cho mỗi vòng lặp.

## 2. Quy định Đăng tải (Upload Rules)

*   **Giới hạn Video:** Hệ thống sẽ chặn và thông báo lỗi nếu người dùng chọn video dài hơn **30 giây**.
*   **Thời gian tồn tại:** Khoảnh khắc sẽ hiển thị công khai trong **24 giờ**. Sau thời gian này, nội dung sẽ được tự động chuyển vào "Kho lưu trữ" (Archive).
*   **Quyền riêng tư:** 3 chế độ mặc định:
    *   **Tất cả bạn bè:** Công khai cho danh sách bạn bè Zalo.
    *   **Chọn bạn bè:** Chỉ những người được chọn mới thấy.
    *   **Loại trừ:** Hiển thị cho tất cả trừ những người bị chỉ định.

## 3. Thứ tự hiển thị Feed (Feed Sorting)

Danh sách Story được sắp xếp theo độ ưu tiên giảm dần:
1.  **Tôi (My Story):** Luôn nằm ở vị trí đầu tiên bên trái.
2.  **Bạn bè chưa xem (Unviewed):** Những người có tin mới chưa xem hết, sắp xếp theo thời gian đăng mới nhất.
3.  **Bạn bè đã xem hết (Viewed):** Những người đã xem hết tin, sắp xếp theo thời gian và có độ mờ (opacity) nhẹ để phân biệt.

## 4. Điều hướng (Navigation)

*   **Chạm trái (50% màn hình):** Quay lại mẩu tin trước. Nếu là tin đầu tiên của người này, sẽ quay lại tin **cuối cùng** của người trước đó.
*   **Chạm phải (50% màn hình):** Tiến tới mẩu tin tiếp theo. Nếu là tin cuối cùng, tự động chuyển sang người tiếp theo.
*   **Nhấn giữ:** Tạm dừng (Pause) thanh tiến trình để quan sát nội dung.
*   **Vuốt xuống:** Đóng trình xem Story.

---
*Cập nhật lần cuối: 06/05/2026*
