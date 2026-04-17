import { api } from "@/shared/services/apiClient";
import { Poll } from "../types";

export const pollService = {
    /** Lấy danh sách bình chọn trong phòng */
    async getPollsInRoom(roomId: string): Promise<Poll[]> {
        const { data } = await api.get(`/polls/room/${roomId}`);
        return data;
    },

    /** Tạo bình chọn mới */
    async createPoll(payload: { roomId: string, question: string, options: string[], allowMultipleChoices: boolean, allowAddOptions: boolean }): Promise<Poll> {
        const { data } = await api.post(`/polls`, payload);
        return data;
    },

    /** Bình chọn */
    async votePoll(pollId: string, optionIds: string[]): Promise<Poll> {
        const { data } = await api.post(`/polls/vote`, { pollId, optionIds });
        return data;
    },

    /** Thêm lựa chọn mới vào bình chọn */
    async addOptionToPoll(pollId: string, text: string): Promise<Poll> {
        const { data } = await api.post(`/polls/options`, { pollId, text });
        return data;
    },

    /** Đóng bình chọn */
    async closePoll(pollId: string): Promise<Poll> {
        const { data } = await api.put(`/polls/${pollId}/close`);
        return data;
    },

    /** Xóa bình chọn */
    async deletePoll(pollId: string): Promise<void> {
        await api.delete(`/polls/${pollId}`);
    }
};
