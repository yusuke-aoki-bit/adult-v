'use client';

import { memo } from 'react';
import { HeaderBase } from '@adult-v/shared/components';
import SearchBar from './SearchBar';
import LanguageSwitcher from './LanguageSwitcher';
import NotificationSubscriber from './NotificationSubscriber';
import { useSite } from '@/lib/contexts/SiteContext';

const Header = memo(function Header() {
  const { isFanzaSite } = useSite();

  return (
    <HeaderBase
      SearchBar={SearchBar}
      LanguageSwitcher={LanguageSwitcher}
      NotificationSubscriber={NotificationSubscriber}
      isFanzaSite={isFanzaSite}
    />
  );
});

export default Header;
