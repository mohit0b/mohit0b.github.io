const ShipmentModel = require('../models/Shipment');
const UserModel = require('../models/User');
const { AppError } = require('../middleware/errorHandler');

const createShipment = async (req, res) => {
  const { 
    origin_address, 
    destination_address, 
    driver_id, 
    organization_id = null,
    estimated_delivery = null,
    notes = null
  } = req.body;

  const driver = await UserModel.findById(driver_id);
  if (!driver) {
    throw new AppError('Driver not found', 404, 'DRIVER_NOT_FOUND');
  }

  if (driver.role !== 'driver') {
    throw new AppError('Assigned user must be a driver', 400, 'INVALID_DRIVER_ROLE');
  }

  if (req.user.role === 'admin' && organization_id && req.user.organizationId) {
    if (organization_id !== req.user.organizationId) {
      throw new AppError('Cannot create shipment for different organization', 403, 'ORGANIZATION_MISMATCH');
    }
  }

  const shipment = await ShipmentModel.create({
    origin_address,
    destination_address,
    driver_id,
    organization_id: organization_id || req.user.organizationId,
    estimated_delivery,
    notes
  });

  res.status(201).json({
    success: true,
    data: {
      shipment: {
        id: shipment.id,
        tracking_number: shipment.tracking_number,
        origin_address: shipment.origin_address,
        destination_address: shipment.destination_address,
        driver_id: shipment.driver_id,
        organization_id: shipment.organization_id,
        status: shipment.status,
        estimated_delivery: shipment.estimated_delivery,
        notes: shipment.notes
      }
    }
  });
};

const getShipments = async (req, res) => {
  const { status, driver_id } = req.query;
  
  let shipments = await ShipmentModel.findAll(
    req.user.role,
    req.user.id,
    req.user.organizationId
  );

  if (status) {
    shipments = shipments.filter(s => s.status === status);
  }

  if (driver_id && req.user.role === 'admin') {
    shipments = shipments.filter(s => s.driver_id == driver_id);
  }

  res.status(200).json({
    success: true,
    data: {
      shipments: shipments.map(shipment => ({
        id: shipment.id,
        tracking_number: shipment.tracking_number,
        origin_address: shipment.origin_address,
        destination_address: shipment.destination_address,
        driver_id: shipment.driver_id,
        driver_name: shipment.driver_name,
        driver_email: shipment.driver_email,
        organization_id: shipment.organization_id,
        status: shipment.status,
        estimated_delivery: shipment.estimated_delivery,
        notes: shipment.notes,
        created_at: shipment.created_at,
        updated_at: shipment.updated_at
      })),
      total: shipments.length
    }
  });
};

const getShipment = async (req, res) => {
  const { id } = req.params;

  const shipment = await ShipmentModel.findById(
    id,
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
        organization_id: shipment.organization_id,
        status: shipment.status,
        estimated_delivery: shipment.estimated_delivery,
        notes: shipment.notes,
        created_at: shipment.created_at,
        updated_at: shipment.updated_at
      }
    }
  });
};

const getShipmentByTrackingNumber = async (req, res) => {
  const { tracking_number } = req.params;

  const shipment = await ShipmentModel.findByTrackingNumber(
    tracking_number,
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
        organization_id: shipment.organization_id,
        status: shipment.status,
        estimated_delivery: shipment.estimated_delivery,
        notes: shipment.notes,
        created_at: shipment.created_at,
        updated_at: shipment.updated_at
      }
    }
  });
};

const confirmDelivery = async (req, res) => {
  const { id } = req.params;
  const { delivery_notes, proof_of_delivery_url } = req.body;

  const shipment = await ShipmentModel.confirmDelivery(id, req.user.id, {
    delivery_notes,
    proof_of_delivery_url
  });

  try {
    const socketHandler = req.app.get('socketHandler');
    if (socketHandler && socketHandler.emitShipmentDelivered) {
      socketHandler.emitShipmentDelivered(id, {
        delivered_at: shipment.delivered_at,
        delivery_notes: shipment.delivery_notes,
        proof_of_delivery_url: shipment.proof_of_delivery_url
      });
    }
  } catch (socketError) {
    console.error('Socket emission failed:', socketError.message);
  }

  res.status(200).json({
    success: true,
    data: {
      shipment: {
        id: shipment.id,
        tracking_number: shipment.tracking_number,
        status: shipment.status,
        delivered_at: shipment.delivered_at,
        delivery_notes: shipment.delivery_notes,
        proof_of_delivery_url: shipment.proof_of_delivery_url,
        updated_at: shipment.updated_at
      }
    }
  });
};

const getAssignedShipments = async (req, res) => {
  // Get shipments assigned to the current driver
  const shipments = await ShipmentModel.findByDriverId(req.user.id);

  res.status(200).json({
    success: true,
    data: shipments.map(shipment => ({
      id: shipment.id,
      tracking_number: shipment.tracking_number,
      origin_address: shipment.origin_address,
      destination_address: shipment.destination_address,
      current_latitude: shipment.current_latitude,
      current_longitude: shipment.current_longitude,
      status: shipment.status,
      estimated_delivery: shipment.estimated_delivery,
      created_at: shipment.created_at,
      updated_at: shipment.updated_at
    }))
  });
};

// Demo endpoint to create test shipment
const createDemoShipment = async (req, res) => {
  const shipment = await ShipmentModel.create({
    origin_address: 'Mumbai Warehouse, Andheri East, Mumbai',
    destination_address: 'Pune Central Store, MG Road, Pune',
    driver_id: req.user.id,
    organization_id: null,
    estimated_delivery: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Demo shipment for testing'
  });

  res.status(201).json({
    success: true,
    data: shipment
  });
};

module.exports = {
  createShipment,
  getShipments,
  getShipment,
  getShipmentByTrackingNumber,
  confirmDelivery,
  getAssignedShipments,
  createDemoShipment
};
