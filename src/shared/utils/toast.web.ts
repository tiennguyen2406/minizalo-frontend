import toast from 'react-hot-toast';

export const showToast = {
    success: (message: string, options?: any) => toast.success(message, options),
    error: (message: string, options?: any) => toast.error(message, options),
    loading: (message: string, options?: any) => toast.loading(message, options),
    dismiss: (id?: string) => toast.dismiss(id),
};
