import React from 'react';
import { useApp } from '../../context/AppContext';
import { COACH_NAV } from '../../config/navigation';
import { PortalShell } from '../common/PortalShell';
import { PortalIdentity } from '../common/PortalIdentity';
import { CoachDashboard } from './CoachDashboard';
import { CoachClients } from './CoachClients';
import { CoachSchedule } from './CoachSchedule';
import { CoachProgramBuilder } from './CoachProgramBuilder';
import { CoachNutritionPlanner } from './CoachNutritionPlanner';

export const CoachLayout: React.FC = () => {
  const { coachTab, setCoachTab, currentUser, coachProfiles } = useApp();
  const coach = currentUser ? coachProfiles[currentUser.id] : null;

  return (
    <PortalShell
      id="coach"
      navItems={COACH_NAV}
      activeTab={coachTab}
      onTabChange={setCoachTab}
      header={
        <PortalIdentity
          name={currentUser?.name ?? 'Coach'}
          subtitle="Personal Trainer APEX"
          detail={coach?.title || 'Certified Coach'}
          statusLabel="COACH"
        />
      }
    >
      {coachTab === 'dashboard' && <CoachDashboard />}
      {coachTab === 'clients' && <CoachClients />}
      {coachTab === 'schedule' && <CoachSchedule />}
      {coachTab === 'builder' && <CoachProgramBuilder />}
      {coachTab === 'nutrition' && <CoachNutritionPlanner />}
    </PortalShell>
  );
};
