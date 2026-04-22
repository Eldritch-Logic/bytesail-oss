import { apikeyRouter } from "./routers/apikey.js";
import { composeRouter } from "./routers/compose.js";
import { databaseRouter } from "./routers/database.js";
import { deploymentRouter } from "./routers/deployment.js";
import { domainRouter } from "./routers/domain.js";
import { environmentRouter } from "./routers/environment.js";
import { gitRouter } from "./routers/git.js";
import { monitoringRouter } from "./routers/monitoring.js";
import { notificationRouter } from "./routers/notification.js";
import { projectRouter } from "./routers/project.js";
import { serviceRouter } from "./routers/service.js";
import { settingsRouter } from "./routers/settings.js";
import { templateRouter } from "./routers/template.js";
import { variableRouter } from "./routers/variable.js";
import { volumeRouter } from "./routers/volume.js";
import { router } from "./trpc.js";

export const appRouter = router({
	apikey: apikeyRouter,
	compose: composeRouter,
	database: databaseRouter,
	deployment: deploymentRouter,
	domain: domainRouter,
	environment: environmentRouter,
	git: gitRouter,
	monitoring: monitoringRouter,
	notification: notificationRouter,
	project: projectRouter,
	service: serviceRouter,
	settings: settingsRouter,
	template: templateRouter,
	variable: variableRouter,
	volume: volumeRouter,
});

export type AppRouter = typeof appRouter;
