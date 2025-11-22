import { useState, useEffect } from 'react';
import { StorageService } from '../services/storage.service';

/**
 * Hook para sincronizar estado con localStorage
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  // Estado inicial desde localStorage o valor por defecto
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = StorageService.get<T>(key);
      return item !== null ? item : initialValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return initialValue;
    }
  });

  // Función para actualizar el estado y localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Permite que value sea una función como en useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;

      // Guardar en estado
      setStoredValue(valueToStore);

      // Guardar en localStorage
      StorageService.set(key, valueToStore);
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  };

  // Sincronizar con cambios en otras tabs/ventanas
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `styleprint_${key}` && e.newValue) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch (error) {
          console.error('Error parsing storage event:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue] as const;
}
