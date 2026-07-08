import { dashboardService, superAdminService } from '../services/api';

export const businessApi = {
  getBusinesses: superAdminService.getBusinesses,
  createBusiness: superAdminService.createBusiness,
  updateBusiness: superAdminService.updateBusiness,
  activateBusiness: superAdminService.activateBusiness,
  suspendBusiness: superAdminService.suspendBusiness,
  assignPlan: superAdminService.assignPlan,
  listPlans: superAdminService.listPlans,
  createPlan: superAdminService.createPlan,
  updatePlan: superAdminService.updatePlan,
  deletePlan: superAdminService.deletePlan,
  getSystemHealth: superAdminService.getSystemHealth,
  getSystemMetrics: superAdminService.getSystemMetrics,
  getSystemEvents: superAdminService.getSystemEvents,
  getDashboardMetrics: dashboardService.getMetrics,
  runNightAudit: dashboardService.runNightAudit
};
