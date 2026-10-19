import React from 'react';
import { useApp } from '../../context/AppContext';
import { AdminDashboard } from './AdminDashboard';
import { AdminQrScanner } from './AdminQrScanner';
import { AdminFinance } from './AdminFinance';
import { AdminSatisfaction } from './AdminSatisfaction';
import { AdminMembers } from './AdminMembers';
import { AdminCoaches } from './AdminCoaches';
import { AdminAnnouncements } from './AdminAnnouncements';
import { AdminAuditLog } from './AdminAuditLog';
import { AdminEquipmentMaintenance } from './AdminEquipmentMaintenance';
import { AdminClassSchedule } from './AdminClassSchedule';
import { ADMIN_NAV } from '../../config/navigation';
import { PortalShell } from '../common/PortalShell';
import { PortalIdentity } from '../common/PortalIdentity';

export const AdminLayout: React.FC = () => {
  const { adminTab, setAdminTab, currentUser } = useApp();

  return (
    <PortalShell
      id="admin"
      navItems={ADMIN_NAV}
      activeTab={adminTab}
      onTabChange={setAdminTab}
      header={
        <PortalIdentity
          name={currentUser?.name ?? 'Admin'}
          subtitle="Operasional APEX Gym"
          detail="Administrator"
          statusLabel="ADMIN"
        />
      }
    >
      {adminTab === 'dashboard' && <AdminDashboard />}
      {adminTab === 'checkin' && <AdminQrScanner />}
      {adminTab === 'classes' && <AdminClassSchedule />}
      {adminTab === 'equipment' && <AdminEquipmentMaintenance />}
      {adminTab === 'keuangan' && <AdminFinance />}
      {adminTab === 'kepuasan' && <AdminSatisfaction />}
      {adminTab === 'members' && <AdminMembers />}
      {adminTab === 'coaches' && <AdminCoaches />}
      {adminTab === 'announcements' && <AdminAnnouncements />}
      {adminTab === 'audit' && <AdminAuditLog />}
    </PortalShell>
  );
};
