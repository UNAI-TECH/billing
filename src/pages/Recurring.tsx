import React from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { RecurringRemindersSection } from '../components/settings/RecurringRemindersSection';

export const Recurring = () => {
  return (
    <MainLayout title="Cash Flow">
      <div className="max-w-7xl mx-auto">
        <RecurringRemindersSection />
      </div>
    </MainLayout>
  );
};
