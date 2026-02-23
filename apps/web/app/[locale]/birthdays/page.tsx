import { Metadata } from 'next';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import Link from 'next/link';
import { localizedHref } from '@adult-v/shared/i18n';
import { Cake, Calendar, Gift, Star, ChevronRight } from 'lucide-react';

// force-dynamic: next-intlのgetTranslationsがheaders()を内部呼出しするためISR不可
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string }>;
}

const metaTranslations = {
  ja: {
    metaTitle: (monthDay: string) => `女優バースデーカレンダー - ${monthDay}`,
    metaDescription: '今日・今週誕生日のAV女優一覧。お気に入り女優の誕生日をチェックして、記念作品を探そう。',
    metaKeywords: ['AV女優', '誕生日', 'バースデー', '女優一覧', '今日の誕生日'],
    ogTitle: '女優バースデーカレンダー',
    ogDescription: '今日誕生日の女優をチェック',
  },
  en: {
    metaTitle: (monthDay: string) => `Actress Birthday Calendar - ${monthDay}`,
    metaDescription:
      'List of AV actresses with birthdays today and this week. Check your favorite actresses birthdays and find their commemorative works.',
    metaKeywords: ['AV actress', 'birthday', 'actress list', 'today birthday'],
    ogTitle: 'Actress Birthday Calendar',
    ogDescription: 'Check actresses with birthdays today',
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const mt = metaTranslations[locale as keyof typeof metaTranslations] || metaTranslations.ja;
  const today = new Date();
  const monthDay = `${today.getMonth() + 1}/${today.getDate()}`;

  return {
    title: mt.metaTitle(monthDay),
    description: mt.metaDescription,
    keywords: mt.metaKeywords,
    openGraph: {
      title: mt.ogTitle,
      description: mt.ogDescription,
    },
  };
}

const translations = {
  ja: {
    title: '女優バースデーカレンダー',
    subtitle: 'お気に入り女優の誕生日をチェック',
    todayBirthdays: '今日が誕生日',
    thisWeekBirthdays: '今週の誕生日',
    thisMonthBirthdays: '今月の誕生日',
    upcomingBirthdays: '来週の誕生日',
    noBirthdays: '該当する女優がいません',
    age: '歳',
    works: '作品',
    viewProfile: 'プロフィールを見る',
    monthlyCalendar: '月別カレンダー',
    months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    prNotice: '当ページには広告・アフィリエイトリンクが含まれています',
  },
  en: {
    title: 'Actress Birthday Calendar',
    subtitle: 'Check your favorite actresses birthdays',
    todayBirthdays: "Today's Birthdays",
    thisWeekBirthdays: 'This Week',
    thisMonthBirthdays: 'This Month',
    upcomingBirthdays: 'Next Week',
    noBirthdays: 'No actresses found',
    age: 'years old',
    works: 'works',
    viewProfile: 'View Profile',
    monthlyCalendar: 'Monthly Calendar',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    prNotice: 'This page contains advertisements and affiliate links',
  },
};

interface BirthdayActress {
  id: number;
  name: string;
  profile_image_url: string | null;
  birthday: string;
  product_count: number;
}

export default async function BirthdaysPage({ params }: Props) {
  const { locale } = await params;
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const db = getDb();

  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  // 今日が誕生日の女優
  const todayBirthdaysResult = await db.execute(sql`
    SELECT
      p.id,
      p.name,
      p.profile_image_url,
      p.birthday,
      COUNT(pp.product_id) as product_count
    FROM performers p
    LEFT JOIN product_performers pp ON p.id = pp.performer_id
    WHERE p.birthday IS NOT NULL
      AND EXTRACT(MONTH FROM p.birthday) = ${todayMonth}
      AND EXTRACT(DAY FROM p.birthday) = ${todayDay}
    GROUP BY p.id, p.name, p.profile_image_url, p.birthday
    ORDER BY product_count DESC
    LIMIT 50
  `);

  // 今週の誕生日（今日を除く、今後7日間）
  const thisWeekResult = await db.execute(sql`
    SELECT
      p.id,
      p.name,
      p.profile_image_url,
      p.birthday,
      COUNT(pp.product_id) as product_count
    FROM performers p
    LEFT JOIN product_performers pp ON p.id = pp.performer_id
    WHERE p.birthday IS NOT NULL
      AND (
        (EXTRACT(MONTH FROM p.birthday) = ${todayMonth} AND EXTRACT(DAY FROM p.birthday) > ${todayDay} AND EXTRACT(DAY FROM p.birthday) <= ${todayDay + 7})
        OR (EXTRACT(MONTH FROM p.birthday) = ${todayMonth + 1} AND EXTRACT(DAY FROM p.birthday) <= ${Math.max(0, todayDay + 7 - 31)})
      )
    GROUP BY p.id, p.name, p.profile_image_url, p.birthday
    ORDER BY EXTRACT(MONTH FROM p.birthday), EXTRACT(DAY FROM p.birthday)
    LIMIT 50
  `);

  // 今月の誕生日（全体）
  const thisMonthResult = await db.execute(sql`
    SELECT
      p.id,
      p.name,
      p.profile_image_url,
      p.birthday,
      COUNT(pp.product_id) as product_count
    FROM performers p
    LEFT JOIN product_performers pp ON p.id = pp.performer_id
    WHERE p.birthday IS NOT NULL
      AND EXTRACT(MONTH FROM p.birthday) = ${todayMonth}
    GROUP BY p.id, p.name, p.profile_image_url, p.birthday
    ORDER BY EXTRACT(DAY FROM p.birthday), product_count DESC
    LIMIT 100
  `);

  const todayBirthdays = todayBirthdaysResult.rows as unknown as BirthdayActress[];
  const thisWeekBirthdays = thisWeekResult.rows as unknown as BirthdayActress[];
  const thisMonthBirthdays = thisMonthResult.rows as unknown as BirthdayActress[];

  const calculateAge = (birthday: string): number | null => {
    if (!birthday) return null;
    const birthDate = new Date(birthday);
    const ageDiff = today.getTime() - birthDate.getTime();
    const ageDate = new Date(ageDiff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const formatBirthday = (birthday: string): string => {
    const date = new Date(birthday);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const months = t.months;

  return (
    <main className="theme-body min-h-screen py-8">
      <div className="container mx-auto max-w-6xl px-4">
        {/* PR表記 */}
        <p className="mb-4 text-center text-xs text-gray-400">
          <span className="mr-1.5 rounded bg-yellow-900/30 px-1.5 py-0.5 font-bold text-yellow-400">PR</span>
          {t.prNotice}
        </p>

        {/* ヘッダー */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/20 px-4 py-2">
            <Cake className="h-5 w-5 text-pink-400" />
            <span className="font-medium text-pink-300">{formatBirthday(today.toISOString())}</span>
          </div>
          <h1 className="theme-text mb-2 text-3xl font-bold">{t.title}</h1>
          <p className="theme-text-muted">{t.subtitle}</p>
        </div>

        {/* 今日が誕生日 */}
        <section className="mb-10">
          <h2 className="theme-text mb-4 flex items-center gap-2 text-xl font-bold">
            <Gift className="h-6 w-6 text-pink-400" />
            {t.todayBirthdays}
            {todayBirthdays.length > 0 && (
              <span className="text-sm font-normal text-pink-400">({todayBirthdays.length}人)</span>
            )}
          </h2>
          {todayBirthdays.length === 0 ? (
            <p className="theme-text-muted py-8 text-center">{t.noBirthdays}</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {todayBirthdays.map((actress) => (
                <Link
                  key={actress.id}
                  href={localizedHref(`/actress/${actress.id}`, locale)}
                  className="theme-card group block overflow-hidden rounded-lg transition-all hover:ring-2 hover:ring-pink-500/50"
                >
                  <div className="relative aspect-[3/4] bg-gray-800">
                    {actress.profile_image_url ? (
                      <img
                        src={actress.profile_image_url}
                        alt={actress.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-600">No Image</div>
                    )}
                    <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-pink-500 px-2 py-1 text-xs font-bold text-white">
                      <Cake className="h-3 w-3" />
                      Today!
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="theme-text truncate text-sm font-medium transition-colors group-hover:text-pink-400">
                      {actress.name}
                    </h3>
                    <div className="theme-text-muted mt-1 flex items-center justify-between text-xs">
                      <span>{calculateAge(actress.birthday) && `${calculateAge(actress.birthday)}${t.age}`}</span>
                      <span>
                        {Number(actress.product_count).toLocaleString()} {t.works}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 今週の誕生日 */}
        <section className="mb-10">
          <h2 className="theme-text mb-4 flex items-center gap-2 text-xl font-bold">
            <Calendar className="h-6 w-6 text-blue-400" />
            {t.thisWeekBirthdays}
          </h2>
          {thisWeekBirthdays.length === 0 ? (
            <p className="theme-text-muted py-8 text-center">{t.noBirthdays}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {thisWeekBirthdays.map((actress) => (
                <Link
                  key={actress.id}
                  href={localizedHref(`/actress/${actress.id}`, locale)}
                  className="theme-card flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-700/50"
                >
                  <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-gray-800">
                    {actress.profile_image_url ? (
                      <img
                        src={actress.profile_image_url}
                        alt={actress.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-gray-600">N/A</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="theme-text truncate text-sm font-medium">{actress.name}</p>
                    <p className="text-xs text-blue-400">{formatBirthday(actress.birthday)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 今月の誕生日一覧 */}
        <section className="mb-10">
          <h2 className="theme-text mb-4 flex items-center gap-2 text-xl font-bold">
            <Star className="h-6 w-6 text-yellow-400" />
            {t.thisMonthBirthdays} ({months[todayMonth - 1]})
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {thisMonthBirthdays.map((actress) => (
              <Link
                key={actress.id}
                href={localizedHref(`/actress/${actress.id}`, locale)}
                className="group flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-gray-700/30"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-10 font-mono text-sm text-gray-400">{formatBirthday(actress.birthday)}</span>
                  <span className="theme-text truncate text-sm transition-colors group-hover:text-pink-400">
                    {actress.name}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-500" />
              </Link>
            ))}
          </div>
        </section>

        {/* 月別カレンダーリンク */}
        <section>
          <h2 className="theme-text mb-4 text-xl font-bold">{t.monthlyCalendar}</h2>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-12">
            {months.map((month, idx) => (
              <Link
                key={idx}
                href={localizedHref(`/birthdays?month=${idx + 1}`, locale)}
                className={`rounded-lg p-3 text-center transition-colors ${
                  idx + 1 === todayMonth
                    ? 'border border-pink-500/50 bg-pink-500/20 text-pink-300'
                    : 'theme-card theme-text hover:bg-gray-700/50'
                }`}
              >
                {month}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
