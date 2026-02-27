const TrackingLocationModel = require('../models/TrackingLocation');
const ShipmentModel = require('../models/Shipment');
const { AppError } = require('../middleware/errorHandler');

const updateLocation = async (req, res) => {
  const { shipment_id, latitude, longitude, accuracy = null, speed = null } = req.body;

  const shipment = await ShipmentModel.findById(shipment_id);
  if (!shipment) {
    throw new AppError('Shipment not found', 404, 'SHIPMENT_NOT_FOUND');
  }

  if (req.user.role === 'driver' && shipment.driver_id !== req.user.id) {
    throw new AppError('You can only update your assigned shipments', 403, 'SHIPMENT_ACCESS_DENIED');
  }

  if (req.user.role === 'admin' && req.user.organizationId && 
      shipment.organization_id && shipment.organization_id !== req.user.organizationId) {
    throw new AppError('Access denied to this shipment', 403, 'ORGANIZATION_ACCESS_DENIED');
  }

  const location = await TrackingLocationModel.create({
    shipment_id,
    latitude,
    longitude,
    accuracy,
    speed
  });

  const firstUpdate = await TrackingLocationModel.getLatestByShipment(shipment_id);
  const isFirstUpdate = firstUpdate && firstUpdate.id === location.id;

  if (isFirstUpdate && shipment.status === 'pending') {
    await ShipmentModel.updateStatus(shipment_id, 'in_transit');
  }

  await ShipmentModel.updateTimestamp(shipment_id);

  const socketHandler = req.app.get('socketHandler');
  if (socketHandler) {
    socketHandler.emitLocationUpdate(shipment_id, {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      speed: location.speed,
      recorded_at: location.recorded_at
    });

    if (isFirstUpdate && shipment.status === 'pending') {
      socketHandler.emitShipmentStatusUpdate(shipment_id, 'in_transit');
    }
  }

  res.status(201).json({
    success: true,
    data: {
      location: {
        id: location.id,
        shipment_id: location.shipment_id,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        speed: location.speed,
        recorded_at: location.recorded_at
      },
      status_updated: isFirstUpdate && shipment.status === 'pending' ? 'in_transit' : shipment.status
    }
  });
};

const getTrackingInfo = async (req, res) => {
  const { shipment_id } = req.params;

  const shipment = await ShipmentModel.findById(
    shipment_id,
    req.user.role,
    req.user.id
  );

  if (!shipment) {
    throw new AppError('Shipment not found', 404, 'SHIPMENT_NOT_FOUND');
  }

  if (req.user.role === 'admin' && req.user.organizationId && 
      shipment.organization_id && shipment.organization_id !== req.user.organizationId) {
    throw new AppError('Access denied to this shipment', 403, 'ORGANIZATION_ACCESS_DENIED');
  }

  const latestLocation = await TrackingLocationModel.getLatestByShipment(shipment_id);
  const stats = await TrackingLocationModel.getShipmentStats(shipment_id);

  res.status(200).json({
    success: true,
    data: {
      shipment: {
        id: shipment.id,
        tracking_number: shipment.tracking_number,
        origin_address: shipment.origin_address,
        destination_address: shipment.destination_address,
        driver_id: shipment.driver_id,
        driver_name: shipment.driver_name,
        driver_email: shipment.driver_email,
        status: shipment.status,
        estimated_delivery: shipment.estimated_delivery,
        created_at: shipment.created_at,
        updated_at: shipment.updated_at
      },
      latest_location: latestLocation ? {
        latitude: latestLocation.latitude,
        longitude: latestLocation.longitude,
        accuracy: latestLocation.accuracy,
        speed: latestLocation.speed,
        recorded_at: latestLocation.recorded_at
      } : null,
      tracking_stats: stats ? {
        total_updates: stats.total_updates,
        first_update: stats.first_update,
        last_update: stats.last_update
      } : null
    }
  });
};

const getLocationHistory = async (req, res) => {
  const { shipment_id } = req.params;
  const { limit = 100, start_date, end_date } = req.query;

  const shipment = await ShipmentModel.findById(
    shipment_id,
    req.user.role,
    req.user.id
  );

  if (!shipment) {
    throw new AppError('Shipment not found', 404, 'SHIPMENT_NOT_FOUND');
  }

  if (req.user.role === 'admin' && req.user.organizationId && 
      shipment.organization_id && shipment.organization_id !== req.user.organizationId) {
    throw new AppError('Access denied to this shipment', 403, 'ORGANIZATION_ACCESS_DENIED');
  }

  const history = await TrackingLocationModel.getLocationHistory(
    shipment_id,
    start_date,
    end_date
  );

  res.status(200).json({
    success: true,
    data: {
      shipment_id: parseInt(shipment_id),
      tracking_number: shipment.tracking_number,
      locations: history.map(loc => ({
        id: loc.id,
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracy,
        speed: loc.speed,
        recorded_at: loc.recorded_at
      })),
      total: history.length
    }
  });
};

module.exports = {
  updateLocation,
  getTrackingInfo,
  getLocationHistory
};
