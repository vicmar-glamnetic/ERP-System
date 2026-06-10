import { pool } from '../../db/client';
import { ServiceError } from '../auth/auth.service';
import {
  CreateRouteBody,
  GPSPingBody,
  ConfirmDeliveryBody,
  FuelLogBody,
  VehicleRow,
  RouteRow,
  RouteWithStops,
  GPSLogRow,
  FuelLogRow,
  DeliveryStopRow,
} from './tms.types';

const ADMIN_ROLES = ['system_admin', 'operations_manager', 'dispatcher'];

// ─── Vehicles ─────────────────────────────────────────────────────────────────

export async function getVehicles(): Promise<VehicleRow[]> {
  const { rows } = await pool.query(
    `SELECT id, plate_number, type, fuel_capacity::float, status, created_at
     FROM vehicles ORDER BY plate_number`
  );
  return rows;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function createRoute(body: CreateRouteBody, createdBy: string): Promise<RouteWithStops> {
  const { route_date, vehicle_id, driver_id, stops } = body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [vehicle] } = await client.query(
      `SELECT id, status FROM vehicles WHERE id = $1 FOR UPDATE`,
      [vehicle_id]
    );
    if (!vehicle) throw new ServiceError('VEHICLE_NOT_FOUND', 'Vehicle not found', 404);
    if (vehicle.status !== 'available') {
      throw new ServiceError('VEHICLE_UNAVAILABLE', 'Vehicle is not available', 409);
    }

    const { rows: [route] } = await client.query(
      `INSERT INTO routes (route_date, vehicle_id, driver_id, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [route_date, vehicle_id, driver_id, createdBy]
    );

    const insertedStops: DeliveryStopRow[] = [];
    for (const stop of stops) {
      const { rows: [s] } = await client.query(
        `INSERT INTO delivery_stops (route_id, so_id, stop_sequence, address, recipient_name, recipient_phone)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [route.id, stop.so_id ?? null, stop.stop_sequence, stop.address, stop.recipient_name ?? null, stop.recipient_phone ?? null]
      );
      insertedStops.push(s as DeliveryStopRow);
    }

    await client.query(`UPDATE vehicles SET status = 'in_use' WHERE id = $1`, [vehicle_id]);

    await client.query('COMMIT');

    // Non-blocking push notification to driver (best-effort, push_token may not exist)
    try {
      const { rows: [driver] } = await pool.query(
        `SELECT full_name, push_token FROM users WHERE id = $1`,
        [driver_id]
      );
      if (driver?.push_token) {
        void sendPushNotification(
          driver.push_token as string,
          'Route Assigned',
          `You have a new delivery route for ${route_date}. ${stops.length} stop(s).`,
          { route_id: route.id as string }
        );
      }
    } catch (_) { /* push_token column may not exist in all environments */ }

    return { ...(route as RouteRow), stops: insertedStops };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getRoutes(filters: { status?: string; page: number; limit: number }): Promise<RouteRow[]> {
  const { status, page, limit } = filters;
  const offset = (page - 1) * limit;
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (status) {
    params.push(status);
    conditions.push(`r.status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT r.id, r.route_date, r.vehicle_id, r.driver_id, r.status,
            r.started_at, r.completed_at, r.created_by, r.created_at,
            v.plate_number, v.type AS vehicle_type, u.full_name AS driver_name,
            COUNT(ds.id)::int AS total_stops,
            COUNT(ds.id) FILTER (WHERE ds.status = 'delivered')::int AS delivered_stops,
            COALESCE(
              json_agg(json_build_object(
                'id', ds.id, 'stop_sequence', ds.stop_sequence, 'status', ds.status,
                'recipient_name', ds.recipient_name, 'address', ds.address,
                'delivered_at', ds.delivered_at, 'notes', ds.notes,
                'pod_photo_url', ds.pod_photo_url, 'so_number', so.so_number
              ) ORDER BY ds.stop_sequence) FILTER (WHERE ds.id IS NOT NULL),
              '[]'::json
            ) AS stops
     FROM routes r
     JOIN vehicles v ON v.id = r.vehicle_id
     JOIN users u ON u.id = r.driver_id
     LEFT JOIN delivery_stops ds ON ds.route_id = r.id
     LEFT JOIN sales_orders so ON so.id = ds.so_id
     ${where}
     GROUP BY r.id, r.route_date, r.vehicle_id, r.driver_id, r.status,
              r.started_at, r.completed_at, r.created_by, r.created_at,
              v.plate_number, v.type, u.full_name
     ORDER BY r.route_date DESC, r.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return rows;
}

export async function getRouteById(id: string): Promise<RouteWithStops | null> {
  const { rows: [route] } = await pool.query(
    `SELECT r.*, v.plate_number, v.type AS vehicle_type, u.full_name AS driver_name
     FROM routes r
     JOIN vehicles v ON v.id = r.vehicle_id
     JOIN users u ON u.id = r.driver_id
     WHERE r.id = $1`,
    [id]
  );
  if (!route) return null;

  const { rows: stops } = await pool.query(
    `SELECT ds.*, s.so_number
     FROM delivery_stops ds
     LEFT JOIN sales_orders s ON s.id = ds.so_id
     WHERE ds.route_id = $1
     ORDER BY ds.stop_sequence`,
    [id]
  );

  return { ...(route as RouteRow), stops: stops as DeliveryStopRow[] };
}

export async function getMyRoute(driverId: string): Promise<RouteWithStops | null> {
  const { rows: [route] } = await pool.query(
    `SELECT r.*, v.plate_number, v.type AS vehicle_type
     FROM routes r
     JOIN vehicles v ON v.id = r.vehicle_id
     WHERE r.driver_id = $1 AND r.status IN ('pending', 'in_progress')
     ORDER BY r.route_date ASC, r.created_at DESC LIMIT 1`,
    [driverId]
  );
  if (!route) return null;

  const { rows: stops } = await pool.query(
    `SELECT ds.*, s.so_number
     FROM delivery_stops ds
     LEFT JOIN sales_orders s ON s.id = ds.so_id
     WHERE ds.route_id = $1
     ORDER BY ds.stop_sequence`,
    [route.id]
  );

  return { ...(route as RouteRow), stops: stops as DeliveryStopRow[] };
}

export async function getMyRoutes(driverId: string, status?: string): Promise<RouteRow[]> {
  const params: unknown[] = [driverId];
  const conditions = ['r.driver_id = $1'];

  if (status) {
    params.push(status);
    conditions.push(`r.status = $${params.length}`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const { rows } = await pool.query(
    `SELECT r.id, r.route_date, r.status, r.started_at, r.completed_at,
            v.plate_number, v.type AS vehicle_type,
            COUNT(ds.id)::int AS stop_count
     FROM routes r
     JOIN vehicles v ON v.id = r.vehicle_id
     LEFT JOIN delivery_stops ds ON ds.route_id = r.id
     ${where}
     GROUP BY r.id, r.route_date, r.status, r.started_at, r.completed_at,
              v.plate_number, v.type
     ORDER BY r.route_date DESC, r.created_at DESC
     LIMIT 50`,
    params
  );
  return rows;
}

export async function getMyFuelLogs(driverId: string): Promise<FuelLogRow[]> {
  const { rows } = await pool.query(
    `SELECT f.id, f.route_id, f.liters::float, f.distance_km::float, f.logged_at,
            ROUND((f.distance_km / NULLIF(f.liters, 0))::numeric, 2)::float AS efficiency_km_per_l,
            v.plate_number, r.route_date
     FROM fuel_logs f
     JOIN vehicles v ON v.id = f.vehicle_id
     JOIN routes r ON r.id = f.route_id
     WHERE f.driver_id = $1
     ORDER BY f.logged_at DESC
     LIMIT 20`,
    [driverId]
  );
  return rows as FuelLogRow[];
}

export async function startRoute(routeId: string, userId: string, userRole: string): Promise<RouteRow> {
  const { rows: [route] } = await pool.query(
    `SELECT id, status, driver_id FROM routes WHERE id = $1`,
    [routeId]
  );
  if (!route) throw new ServiceError('ROUTE_NOT_FOUND', 'Route not found', 404);

  if (!ADMIN_ROLES.includes(userRole) && route.driver_id !== userId) {
    throw new ServiceError('FORBIDDEN', 'This route is not assigned to you', 403);
  }
  if (route.status !== 'pending') {
    throw new ServiceError('INVALID_STATUS', `Route is already ${route.status as string}`, 409);
  }

  const { rows: [updated] } = await pool.query(
    `UPDATE routes SET status = 'in_progress', started_at = NOW() WHERE id = $1 RETURNING *`,
    [routeId]
  );
  return updated as RouteRow;
}

// ─── GPS ──────────────────────────────────────────────────────────────────────

export async function logGPS(body: GPSPingBody, driverId: string): Promise<GPSLogRow> {
  const { route_id, latitude, longitude, speed_kmh } = body;
  const { rows: [log] } = await pool.query(
    `INSERT INTO gps_logs (route_id, driver_id, latitude, longitude, speed_kmh)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [route_id, driverId, latitude, longitude, speed_kmh ?? null]
  );
  return log as GPSLogRow;
}

export async function getLatestGPS(routeId: string): Promise<GPSLogRow | null> {
  const { rows: [log] } = await pool.query(
    `SELECT g.*, u.full_name AS driver_name, v.plate_number
     FROM gps_logs g
     JOIN routes r ON r.id = g.route_id
     JOIN vehicles v ON v.id = r.vehicle_id
     JOIN users u ON u.id = g.driver_id
     WHERE g.route_id = $1
     ORDER BY g.logged_at DESC LIMIT 1`,
    [routeId]
  );
  return (log as GPSLogRow) ?? null;
}

export async function getAllActiveGPS(): Promise<GPSLogRow[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (g.route_id)
            g.id, g.route_id, g.driver_id,
            g.latitude::float, g.longitude::float,
            g.speed_kmh::float, g.logged_at,
            u.full_name AS driver_name,
            v.plate_number, r.route_date
     FROM gps_logs g
     JOIN routes r ON r.id = g.route_id
     JOIN vehicles v ON v.id = r.vehicle_id
     JOIN users u ON u.id = g.driver_id
     WHERE r.status = 'in_progress'
     ORDER BY g.route_id, g.logged_at DESC`
  );
  return rows as GPSLogRow[];
}

// ─── Deliveries ───────────────────────────────────────────────────────────────

export async function confirmDelivery(
  body: ConfirmDeliveryBody,
  userId: string,
  userRole: string
): Promise<DeliveryStopRow> {
  const { stop_id, pod_photo_url, signature_url, notes } = body;
  const outcome = body.status ?? 'delivered';
  const failure_reason = body.failure_reason?.trim() ?? null;

  if (outcome === 'failed' && !failure_reason) {
    throw new ServiceError('MISSING_REASON', 'failure_reason is required when status is failed', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [stop] } = await client.query(
      `SELECT ds.id, ds.route_id, ds.status, ds.so_id, r.driver_id, r.vehicle_id
       FROM delivery_stops ds
       JOIN routes r ON r.id = ds.route_id
       WHERE ds.id = $1`,
      [stop_id]
    );
    if (!stop) throw new ServiceError('STOP_NOT_FOUND', 'Delivery stop not found', 404);

    if (!ADMIN_ROLES.includes(userRole) && stop.driver_id !== userId) {
      throw new ServiceError('FORBIDDEN', 'Not your delivery stop', 403);
    }
    if (['delivered', 'failed'].includes(stop.status as string)) {
      throw new ServiceError('ALREADY_CONFIRMED', 'Stop already confirmed', 409);
    }

    await client.query(`SELECT id FROM routes WHERE id = $1 FOR UPDATE`, [stop.route_id]);

    let updated: DeliveryStopRow;

    if (outcome === 'failed') {
      const { rows: [u] } = await client.query(
        `UPDATE delivery_stops
         SET status = 'failed', delivered_at = NOW(),
             failure_reason = $2, notes = $3
         WHERE id = $1 RETURNING *`,
        [stop_id, failure_reason, notes ?? null]
      );
      updated = u as DeliveryStopRow;

      // Insert failed delivery log
      await client.query(
        `INSERT INTO failed_delivery_logs (stop_id, route_id, so_id, driver_id, failure_reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [stop_id, stop.route_id, stop.so_id ?? null, userId, failure_reason]
      );

      // Mark SO as delivery_failed
      if (stop.so_id) {
        await client.query(
          `UPDATE sales_orders SET status = 'delivery_failed', updated_at = NOW()
           WHERE id = $1`,
          [stop.so_id]
        );
      }
    } else {
      const { rows: [u] } = await client.query(
        `UPDATE delivery_stops
         SET status = 'delivered', delivered_at = NOW(),
             pod_photo_url = $2, signature_url = $3, notes = $4
         WHERE id = $1 RETURNING *`,
        [stop_id, pod_photo_url ?? null, signature_url ?? null, notes ?? null]
      );
      updated = u as DeliveryStopRow;
    }

    // Complete route only when no stops remain pending
    const { rows: [{ pending_count }] } = await client.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'pending') AS pending_count
       FROM delivery_stops WHERE route_id = $1`,
      [stop.route_id]
    );

    if (parseInt(pending_count as string) === 0) {
      await client.query(
        `UPDATE routes SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [stop.route_id]
      );
      await client.query(
        `UPDATE vehicles SET status = 'available' WHERE id = $1`,
        [stop.vehicle_id]
      );
    }

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getFailedDeliveries(resolution?: string) {
  const conditions = [`ds.status = 'failed'`];
  const params: unknown[] = [];

  if (resolution === 'pending') {
    conditions.push(`ds.resolution IS NULL`);
  } else if (resolution) {
    params.push(resolution);
    conditions.push(`ds.resolution = $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT ds.id AS stop_id, ds.route_id, ds.so_id,
            ds.address, ds.failure_reason, ds.resolution,
            ds.rescheduled_to_stop_id, ds.delivered_at AS failed_at,
            so.so_number, so.customer_name,
            u.full_name AS driver_name,
            r.route_date,
            fdl.id AS log_id
     FROM delivery_stops ds
     JOIN routes r ON r.id = ds.route_id
     JOIN users u ON u.id = r.driver_id
     LEFT JOIN sales_orders so ON so.id = ds.so_id
     LEFT JOIN failed_delivery_logs fdl ON fdl.stop_id = ds.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY ds.delivered_at DESC`,
    params
  );
  return rows;
}

export async function rescheduleFailedDelivery(
  stop_id: string,
  route_id: string,
  stop_sequence: number,
  resolvedBy: string
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [stop] } = await client.query(
      `SELECT * FROM delivery_stops WHERE id = $1 AND status = 'failed' FOR UPDATE`,
      [stop_id]
    );
    if (!stop) throw new ServiceError('NOT_FOUND', 'Failed stop not found', 404);
    if (stop.resolution) {
      throw new ServiceError('ALREADY_RESOLVED', 'Stop already resolved', 409);
    }

    // Verify target route exists and is pending/planned
    const { rows: [targetRoute] } = await client.query(
      `SELECT id, status FROM routes WHERE id = $1`,
      [route_id]
    );
    if (!targetRoute) throw new ServiceError('NOT_FOUND', 'Target route not found', 404);
    if (!['pending', 'planned', 'active'].includes(targetRoute.status as string)) {
      throw new ServiceError('INVALID_STATUS', 'Target route must be pending, planned, or active', 400);
    }

    // Insert new stop on target route
    const { rows: [newStop] } = await client.query(
      `INSERT INTO delivery_stops
         (route_id, so_id, stop_sequence, address, recipient_name, recipient_phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [route_id, stop.so_id, stop_sequence, stop.address, stop.recipient_name, stop.recipient_phone]
    );

    // Update original failed stop
    await client.query(
      `UPDATE delivery_stops
       SET resolution = 'rescheduled', rescheduled_to_stop_id = $2
       WHERE id = $1`,
      [stop_id, newStop.id]
    );

    // Update failed_delivery_logs
    await client.query(
      `UPDATE failed_delivery_logs
       SET resolution = 'rescheduled', resolved_by = $2, resolved_at = NOW()
       WHERE stop_id = $1`,
      [stop_id, resolvedBy]
    );

    // SO back to dispatched
    if (stop.so_id) {
      await client.query(
        `UPDATE sales_orders SET status = 'dispatched', updated_at = NOW() WHERE id = $1`,
        [stop.so_id]
      );
    }

    await client.query('COMMIT');
    return newStop;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function cancelFailedDelivery(
  stop_id: string,
  reason: string,
  resolvedBy: string
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [stop] } = await client.query(
      `SELECT * FROM delivery_stops WHERE id = $1 AND status = 'failed' FOR UPDATE`,
      [stop_id]
    );
    if (!stop) throw new ServiceError('NOT_FOUND', 'Failed stop not found', 404);
    if (stop.resolution) {
      throw new ServiceError('ALREADY_RESOLVED', 'Stop already resolved', 409);
    }

    await client.query(
      `UPDATE delivery_stops SET resolution = 'cancelled' WHERE id = $1`,
      [stop_id]
    );

    await client.query(
      `UPDATE failed_delivery_logs
       SET resolution = 'cancelled', resolved_by = $2, resolved_at = NOW()
       WHERE stop_id = $1`,
      [stop_id, resolvedBy]
    );

    if (stop.so_id) {
      await client.query(
        `UPDATE sales_orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
        [stop.so_id]
      );
      await client.query(
        `UPDATE sales_invoices SET status = 'voided'
         WHERE so_id = $1 AND status != 'voided'`,
        [stop.so_id]
      );
    }

    await client.query('COMMIT');
    return { stop_id, resolution: 'cancelled', reason, resolved_by: resolvedBy };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Fuel ─────────────────────────────────────────────────────────────────────

export async function submitFuelLog(body: FuelLogBody, driverId: string): Promise<FuelLogRow> {
  const { route_id, liters, distance_km } = body;

  // Derive vehicle_id from the route if not provided
  let vehicle_id = body.vehicle_id;
  if (!vehicle_id) {
    const { rows: [route] } = await pool.query(
      `SELECT vehicle_id FROM routes WHERE id = $1 AND driver_id = $2`,
      [route_id, driverId]
    );
    if (!route) throw new ServiceError('NOT_FOUND', 'Route not found or not assigned to you', 404);
    vehicle_id = route.vehicle_id as string;
  }

  const { rows: [log] } = await pool.query(
    `INSERT INTO fuel_logs (route_id, driver_id, vehicle_id, liters, distance_km)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, route_id, driver_id, vehicle_id,
               liters::float, distance_km::float, logged_at,
               ROUND((distance_km / NULLIF(liters, 0))::numeric, 2)::float AS efficiency_km_per_l`,
    [route_id, driverId, vehicle_id, liters, distance_km]
  );
  return log as FuelLogRow;
}

export async function getFuelLogs(filters: {
  vehicle_id?: string;
  driver_id?: string;
  page: number;
  limit: number;
}): Promise<FuelLogRow[]> {
  const { vehicle_id, driver_id, page, limit } = filters;
  const offset = (page - 1) * limit;
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (vehicle_id) {
    params.push(vehicle_id);
    conditions.push(`f.vehicle_id = $${params.length}`);
  }
  if (driver_id) {
    params.push(driver_id);
    conditions.push(`f.driver_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT f.*, u.full_name AS driver_name, v.plate_number,
            f.liters::float, f.distance_km::float
     FROM fuel_logs f
     JOIN users u ON u.id = f.driver_id
     JOIN vehicles v ON v.id = f.vehicle_id
     ${where}
     ORDER BY f.logged_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return rows as FuelLogRow[];
}

// ─── Push Notifications ───────────────────────────────────────────────────────

export async function savePushToken(userId: string, token: string): Promise<void> {
  try {
    await pool.query(`UPDATE users SET push_token = $1 WHERE id = $2`, [token, userId]);
  } catch (_) { /* push_token column may not exist in all environments */ }
}

export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: pushToken, title, body, data: data ?? {}, sound: 'default' }),
    });
  } catch (err) {
    console.error('Push notification failed:', err);
  }
}
