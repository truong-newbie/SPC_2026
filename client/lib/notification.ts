/**
 * SPC_2026 Web Notification API Helper
 * Displays native OS notifications when transfers complete while user is on another tab
 */

export async function requestNotificationPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return false;
    }
    if (Notification.permission === 'granted') {
        return true;
    }
    if (Notification.permission !== 'denied') {
        try {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        } catch {
            return false;
        }
    }
    return false;
}

export function sendTransferNotification(title: string, body: string): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        try {
            new Notification(title, {
                body,
                icon: '/logo.png',
                badge: '/favicon.ico',
            });
        } catch {
            // Some mobile browsers restrict notification constructor without service worker
        }
    }
}
