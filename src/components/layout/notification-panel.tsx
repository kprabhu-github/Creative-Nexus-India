"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Bell,
  X,
  Check,
  CheckCheck,
  Zap,
  Target,
  Mail,
  Eye,
  BarChart3,
  AlertTriangle,
  Clock,
  ExternalLink,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationAction {
  label: string;
  url?: string;
  api?: string;
}

interface Notification {
  id: string;
  title: string;
  message: string | null;
  category: string;
  priority: string;
  source_module: string | null;
  source_url: string | null;
  actions: NotificationAction[];
  is_read: boolean;
  is_dismissed: boolean;
  is_actioned: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function categoryIcon(category: string): LucideIcon {
  switch (category) {
    case "agent_run":
    case "workflow":
      return Zap;
    case "lead":
    case "gtm":
      return Target;
    case "outreach":
    case "campaign":
      return Mail;
    case "searchlens":
    case "visibility":
      return Eye;
    case "social":
    case "analysis":
      return BarChart3;
    case "alert":
    case "error":
      return AlertTriangle;
    default:
      return Bell;
  }
}

function priorityBadgeType(
  priority: string,
): "error" | "warning" | "info" | "neutral" {
  switch (priority) {
    case "critical":
      return "error";
    case "high":
      return "warning";
    case "medium":
      return "info";
    case "low":
    default:
      return "neutral";
  }
}

function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) return "just now";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return `${Math.floor(diffSeconds / 86400)}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Fetch notifications when panel opens
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/xapi/notifs?limit=20&unread=true");
      if (res.ok) {
        const json = (await res.json()) as { data: Notification[] };
        setNotifications(json.data ?? []);
        setUnreadCount(
          (json.data ?? []).filter((n) => !n.is_read).length,
        );
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll for unread count every 30 seconds when closed
  useEffect(() => {
    const checkUnread = async () => {
      try {
        const res = await fetch("/xapi/notifs?limit=50&unread=true");
        if (res.ok) {
          const json = (await res.json()) as { data: Notification[] };
          setUnreadCount((json.data ?? []).length);
        }
      } catch {
        // Silently fail — next poll will retry
      }
    };
    void checkUnread();
    const interval = setInterval(() => void checkUnread(), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = useCallback(() => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) {
      void fetchNotifications();
    }
  }, [open, fetchNotifications]);

  // Mark a single notification as read
  const markAsRead = useCallback(
    async (id: string) => {
      try {
        await fetch(`/xapi/notifs/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_read: true }),
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    },
    [],
  );

  // Dismiss a notification
  const dismissNotification = useCallback(
    async (id: string) => {
      try {
        await fetch(`/xapi/notifs/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_dismissed: true }),
        });
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error("Failed to dismiss notification:", err);
      }
    },
    [],
  );

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.is_read);
    await Promise.all(
      unread.map((n) =>
        fetch(`/xapi/notifs/${n.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_read: true }),
        }),
      ),
    );
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [notifications]);

  // Group by priority
  const grouped = notifications.reduce<Record<string, Notification[]>>(
    (acc, n) => {
      const key = n.priority ?? "medium";
      if (!acc[key]) acc[key] = [];
      acc[key].push(n);
      return acc;
    },
    {},
  );
  const priorityOrder = ["critical", "high", "medium", "low"];

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="relative text-foreground-tertiary hover:text-foreground"
        onClick={handleToggle}
      >
        <Bell className="w-4 h-4" strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center bg-accent text-white text-[10px] font-bold rounded-full px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[400px] max-h-[520px] bg-background rounded-[12px] border border-border shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-divider">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-foreground">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="text-[11px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-foreground-tertiary hover:text-foreground"
                  onClick={() => void markAllAsRead()}
                >
                  <CheckCheck className="w-3 h-3 mr-1" strokeWidth={2} />
                  Mark All Read
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setOpen(false)}
                className="text-foreground-tertiary hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2} />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[440px]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-accent animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <div className="w-10 h-10 rounded-full bg-foreground-tertiary/8 flex items-center justify-center mb-3">
                  <Bell className="w-5 h-5 text-foreground-tertiary" strokeWidth={1.5} />
                </div>
                <p className="text-[13px] font-medium text-foreground">
                  All caught up
                </p>
                <p className="text-[12px] text-foreground-tertiary mt-0.5">
                  No unread notifications
                </p>
              </div>
            ) : (
              <div>
                {priorityOrder.map((priority) => {
                  const items = grouped[priority];
                  if (!items || items.length === 0) return null;

                  return (
                    <div key={priority}>
                      {/* Priority group header */}
                      <div className="px-4 py-1.5 bg-background-secondary">
                        <StatusBadge type={priorityBadgeType(priority)}>
                          {priority.charAt(0).toUpperCase() + priority.slice(1)}
                        </StatusBadge>
                      </div>

                      {/* Notification items */}
                      {items.map((notification) => {
                        const Icon = categoryIcon(notification.category);
                        return (
                          <div
                            key={notification.id}
                            className={`px-4 py-3 border-b border-divider hover:bg-surface-hover transition-colors cursor-pointer ${
                              !notification.is_read
                                ? "bg-accent/3"
                                : ""
                            }`}
                            onClick={() => {
                              if (!notification.is_read) {
                                void markAsRead(notification.id);
                              }
                              if (notification.source_url) {
                                window.location.href =
                                  notification.source_url;
                                setOpen(false);
                              }
                            }}
                          >
                            <div className="flex items-start gap-3">
                              {/* Icon */}
                              <div className="w-7 h-7 rounded-[7px] bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                                <Icon
                                  className="w-3.5 h-3.5 text-accent"
                                  strokeWidth={2}
                                />
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p
                                    className={`text-[13px] leading-tight truncate ${
                                      !notification.is_read
                                        ? "font-semibold text-foreground"
                                        : "font-medium text-foreground-secondary"
                                    }`}
                                  >
                                    {notification.title}
                                  </p>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[11px] text-foreground-tertiary flex items-center gap-0.5">
                                      <Clock className="w-2.5 h-2.5" />
                                      {timeAgo(notification.created_at)}
                                    </span>
                                  </div>
                                </div>

                                {notification.message && (
                                  <p className="text-[12px] text-foreground-tertiary mt-0.5 line-clamp-2 leading-relaxed">
                                    {notification.message}
                                  </p>
                                )}

                                {/* Actions */}
                                {notification.actions.length > 0 && (
                                  <div className="flex items-center gap-1.5 mt-2">
                                    {notification.actions.map(
                                      (action, i) => (
                                        <Button
                                          key={i}
                                          variant="outline"
                                          size="xs"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (action.url) {
                                              window.location.href =
                                                action.url;
                                              setOpen(false);
                                            }
                                          }}
                                        >
                                          <ExternalLink className="w-2.5 h-2.5 mr-0.5" />
                                          {action.label}
                                        </Button>
                                      ),
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      className="text-foreground-tertiary"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void dismissNotification(
                                          notification.id,
                                        );
                                      }}
                                    >
                                      <Check className="w-2.5 h-2.5 mr-0.5" />
                                      Dismiss
                                    </Button>
                                  </div>
                                )}
                              </div>

                              {/* Unread indicator */}
                              {!notification.is_read && (
                                <div className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1.5" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
