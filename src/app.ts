import express from 'express';
import cors from 'cors';
import authRouter from './modules/auth/auth.routes';
import hrisRouter from './modules/hris/hris.routes';
import { inventoryRouter, productsRouter, warehousesRouter } from './modules/inventory/inventory.routes';
import wmsRouter from './modules/wms/wms.routes';
import tmsRouter from './modules/tms/tms.routes';
import financeRouter from './modules/finance/finance.routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/auth', authRouter);
app.use('/hris', hrisRouter);
app.use('/inventory', inventoryRouter);
app.use('/products', productsRouter);
app.use('/warehouses', warehousesRouter);
app.use('/wms', wmsRouter);
app.use('/tms', tmsRouter);
app.use('/finance', financeRouter);
app.use(errorHandler);

export default app;
