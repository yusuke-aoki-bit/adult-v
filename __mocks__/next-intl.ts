import { vi } from 'vitest';

export const useTranslations = () => {
  return (key: string, values?: Record<string, unknown>) => {
    if (values) {
      return `${key}:${JSON.stringify(values)}`;
    }
    return key;
  };
};

export const useLocale = () => 'ja';

export const useMessages = () => ({});

export const useTimeZone = () => 'Asia/Tokyo';

export const useNow = () => new Date();

export const useFormatter = () => ({
  number: (value: number) => value.toString(),
  dateTime: (value: Date) => value.toISOString(),
  relativeTime: (value: Date) => 'just now',
});

export const NextIntlClientProvider = ({ children }: { children: React.ReactNode }) => children;

export const getTranslations = vi.fn().mockImplementation(() => Promise.resolve((key: string) => key));

export const getLocale = vi.fn().mockImplementation(() => Promise.resolve('ja'));

export const getMessages = vi.fn().mockImplementation(() => Promise.resolve({}));
