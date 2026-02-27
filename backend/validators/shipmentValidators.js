const { validate } = require('../middleware/validator');

const createShipmentSchema = {
  body: {
    origin_address: {
      required: true,
      type: 'string',
      minLength: 5,
      maxLength: 1000
    },
    destination_address: {
      required: true,
      type: 'string',
      minLength: 5,
      maxLength: 1000
    },
    driver_id: {
      required: true,
      type: 'number',
      min: 1
    },
    organization_id: {
      required: false,
      type: 'number',
      min: 1
    },
    estimated_delivery: {
      required: false,
      type: 'string',
      pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/
    },
    notes: {
      required: false,
      type: 'string',
      maxLength: 2000
    }
  }
};

const querySchema = {
  query: {
    status: {
      required: false,
      type: 'string',
      enum: ['pending', 'in_transit', 'delivered', 'cancelled']
    },
    driver_id: {
      required: false,
      type: 'number',
      min: 1
    }
  }
};

const updateLocationSchema = {
  body: {
    shipment_id: {
      required: true,
      type: 'number',
      min: 1
    },
    latitude: {
      required: true,
      type: 'number',
      min: -90,
      max: 90
    },
    longitude: {
      required: true,
      type: 'number',
      min: -180,
      max: 180
    },
    accuracy: {
      required: false,
      type: 'number',
      min: 0,
      max: 1000
    },
    speed: {
      required: false,
      type: 'number',
      min: 0,
      max: 500
    }
  }
};

const trackingHistorySchema = {
  params: {
    shipment_id: {
      required: true,
      type: 'string',
      pattern: /^\d+$/
    }
  },
  query: {
    limit: {
      required: false,
      type: 'string',
      pattern: /^\d+$/
    },
    start_date: {
      required: false,
      type: 'string',
      pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/
    },
    end_date: {
      required: false,
      type: 'string',
      pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/
    }
  }
};

const shipmentIdSchema = {
  params: {
    id: {
      required: true,
      type: 'string',
      pattern: /^\d+$/
    }
  }
};

const trackingNumberSchema = {
  params: {
    tracking_number: {
      required: true,
      type: 'string',
      minLength: 10,
      maxLength: 20,
      pattern: /^[A-Z0-9]+$/
    }
  }
};

const confirmDeliverySchema = {
  params: {
    id: {
      required: true,
      type: 'string',
      pattern: /^\d+$/
    }
  },
  body: {
    delivery_notes: {
      required: false,
      type: 'string',
      maxLength: 2000
    },
    proof_of_delivery_url: {
      required: false,
      type: 'string',
      maxLength: 255,
      pattern: /^https?:\/\/.+$/
    }
  }
};

module.exports = {
  createShipmentValidation: validate(createShipmentSchema),
  queryValidation: validate(querySchema),
  updateLocationValidation: validate(updateLocationSchema),
  trackingHistoryValidation: validate(trackingHistorySchema),
  shipmentIdValidation: validate(shipmentIdSchema),
  trackingNumberValidation: validate(trackingNumberSchema),
  confirmDeliveryValidation: validate(confirmDeliverySchema)
};
