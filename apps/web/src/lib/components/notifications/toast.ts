import { toast } from "svelte-sonner";

export function toastSuccess(message: string, description?: string) {
	toast.success(message, { description, duration: 5000 });
}

export function toastError(message: string, description?: string) {
	toast.error(message, { description, duration: 8000 });
}

export function toastWarning(message: string, description?: string) {
	toast.warning(message, { description, duration: 6000 });
}

export function toastInfo(message: string, description?: string) {
	toast.info(message, { description, duration: 5000 });
}

export function toastLoading(message: string) {
	return toast.loading(message);
}

export function toastDismiss(id: string | number) {
	toast.dismiss(id);
}

export { toast };
