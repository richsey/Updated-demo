// src/lib/api/notifications.ts
// Notification management — fetch, create, mark-read

import { supabase } from "@/lib/supabase";
import type { Notification } from "@/lib/types";

export type { Notification };

/** Fetch all notifications for a user, newest first */
export async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(`Fetch notifications failed: ${error.message}`);
  return (data as Notification[]) ?? [];
}

/** Get the count of unread notifications */
export async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) return 0;
  return count ?? 0;
}

/** Mark a single notification as read */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    // @ts-expect-error notifications update type strictness
    .update({ is_read: true })
    .eq("id", notificationId);

  if (error) throw new Error(`Mark read failed: ${error.message}`);
}

/** Mark all notifications as read for a user */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    // @ts-expect-error notifications update type strictness
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) throw new Error(`Mark all read failed: ${error.message}`);
}

/** Create a notification for a user (client-side insert for self-notifications) */
export async function createNotification(
  notification: Omit<Notification, "id" | "created_at">
): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    // @ts-expect-error notifications insert type strictness
    .insert([notification]);

  if (error) throw new Error(`Create notification failed: ${error.message}`);
}
