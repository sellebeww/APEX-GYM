import React from 'react';
import { useApp } from '../../context/AppContext';
import { MEMBER_NAV } from '../../config/navigation';
import { PortalShell } from '../common/PortalShell';
import { PortalIdentity } from '../common/PortalIdentity';
import { MemberDashboard } from './MemberDashboard';
import { MemberQrCard } from './MemberQrCard';
import { MemberMembership } from './MemberMembership';
import { MemberWorkoutTracker } from './MemberWorkoutTracker';
import { MemberProgramNutrition } from './MemberProgramNutrition';
import { MemberCoachBooking } from './MemberCoachBooking';
import { MemberProgressBody } from './MemberProgressBody';
import { MemberArticles } from './MemberArticles';
import { MemberExercises } from './MemberExercises';
import { MemberSatisfaction } from './MemberSatisfaction';
import { MemberClassBooking } from './MemberClassBooking';
import { MemberCalculators } from './MemberCalculators';
import { MemberEquipmentStatus } from './MemberEquipmentStatus';
import { MemberReferralRewards } from './MemberReferralRewards';

const STATUS_UI = {
  ACTIVE: { label: 'AKTIF', tone: 'success' },
  EXPIRING_SOON: { label: 'SEGERA HABIS', tone: 'warning' },
  EXPIRED: { label: 'KEDALUWARSA', tone: 'danger' },
} as const;

export const MemberLayout: React.FC = () => {
  const { memberTab, setMemberTab, currentUser, memberProfiles } = useApp();
  const profile = currentUser ? memberProfiles[currentUser.id] : null;
  const status = profile ? STATUS_UI[profile.status] : null;

  return (
    <PortalShell
      id="member"
      navItems={MEMBER_NAV}
      activeTab={memberTab}
      onTabChange={setMemberTab}
      header={
        <PortalIdentity
          name={currentUser?.name ?? 'Member'}
          subtitle="Member APEX"
          detail={profile?.planName || 'Belum ada paket'}
          statusLabel={status?.label}
          statusTone={status?.tone}
        />
      }
    >
      {memberTab === 'dashboard' && <MemberDashboard />}
      {memberTab === 'qr' && <MemberQrCard />}
      {memberTab === 'workout-log' && <MemberWorkoutTracker />}
      {memberTab === 'classes' && <MemberClassBooking />}
      {memberTab === 'program' && <MemberProgramNutrition />}
      {memberTab === 'coaching' && <MemberCoachBooking />}
      {memberTab === 'tools' && <MemberCalculators />}
      {memberTab === 'body-progress' && <MemberProgressBody />}
      {memberTab === 'membership' && <MemberMembership />}
      {memberTab === 'referral' && <MemberReferralRewards />}
      {memberTab === 'equipment' && <MemberEquipmentStatus />}
      {memberTab === 'exercises' && <MemberExercises />}
      {memberTab === 'articles' && <MemberArticles />}
      {memberTab === 'satisfaction' && <MemberSatisfaction />}
    </PortalShell>
  );
};
