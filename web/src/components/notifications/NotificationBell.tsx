import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, Star, Package, Tag, Info, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as notificationsService from '../../services/notifications.service';
import type { Notification, NotificationType } from '../../types/notification';
import { useAuth } from '../../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const typeIcons: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  REVIEW_AVAILABLE: Star,
  ORDER_STATUS: Package,
  PROMO: Tag,
  SYSTEM: Info,
};

const typeColors: Record<NotificationType, string> = {
  REVIEW_AVAILABLE: 'bg-yellow-100 text-yellow-600',
  ORDER_STATUS: 'bg-blue-100 text-blue-600',
  PROMO: 'bg-app-100 text-app-600',
  SYSTEM: 'bg-gray-100 text-gray-600',
};

interface NotificationBellProps {
  className?: string;
}

export const NotificationBell = ({ className = '' }: NotificationBellProps) => {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cargar contador de no leídas
  const loadUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const count = await notificationsService.getUnreadCount();
      setUnreadCount(count);
    } catch (err) {
      console.error('Error loading unread count:', err);
    }
  }, [isAuthenticated]);

  // Cargar notificaciones
  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setIsLoading(true);
      const response = await notificationsService.getNotifications({ limit: 10 });
      setNotifications(response.data);
      setUnreadCount(response.meta.unreadCount);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Cargar contador al montar y cada 30 segundos
  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  // Cargar notificaciones cuando se abre
  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, loadNotifications]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Marcar como leída
  const handleMarkAsRead = async (notification: Notification) => {
    if (notification.isRead) return;

    try {
      await notificationsService.markAsRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  // Marcar todas como leídas
  const handleMarkAllAsRead = async () => {
    try {
      await notificationsService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  // Obtener link según tipo de notificación
  const getNotificationLink = (notification: Notification): string | null => {
    if (notification.type === 'REVIEW_AVAILABLE' && notification.referenceId) {
      return `/product/${notification.referenceId}`;
    }
    if (notification.type === 'ORDER_STATUS' && notification.referenceId) {
      return `/account/orders/${notification.referenceId}`;
    }
    return null;
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Notificaciones"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 md:w-96 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Notificaciones</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-app-600 hover:text-app-700 font-medium"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          {/* Content */}
          <div className="max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-app-500" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 px-4">
                <Bell className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No tienes notificaciones</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifications.map((notification) => {
                  const Icon = typeIcons[notification.type];
                  const link = getNotificationLink(notification);
                  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
                    addSuffix: true,
                    locale: es,
                  });

                  const content = (
                    <div
                      className={`flex gap-3 p-4 transition-colors ${
                        notification.isRead
                          ? 'bg-white'
                          : 'bg-app-50/50'
                      } hover:bg-gray-50`}
                      onClick={() => handleMarkAsRead(notification)}
                    >
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${typeColors[notification.type]}`}>
                        <Icon className="w-5 h-5" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">{notification.title}</p>
                        <p className="text-gray-600 text-sm line-clamp-2">{notification.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{timeAgo}</p>
                      </div>

                      {/* Unread indicator */}
                      {!notification.isRead && (
                        <div className="w-2 h-2 bg-app-500 rounded-full flex-shrink-0 mt-2" />
                      )}
                    </div>
                  );

                  return link ? (
                    <Link
                      key={notification.id}
                      to={link}
                      onClick={() => setIsOpen(false)}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div key={notification.id}>{content}</div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-100 p-2">
              <Link
                to="/account/notifications"
                onClick={() => setIsOpen(false)}
                className="block w-full text-center py-2 text-sm text-app-600 hover:text-app-700 hover:bg-app-50 rounded-lg transition-colors font-medium"
              >
                Ver todas las notificaciones
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
