'use strict'

const request = require('request');

let Service, Characteristic, UUIDGen;

module.exports = homebridge => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

  homebridge.registerPlatform('homebridge-bbox', 'BboxPlatform', BboxPlatform, true);
}

class BboxPlatform {
  constructor (log, config, api) {
    this.log = log;
    this.config = config;
    this.accessories = [];

    setInterval(() => {
      request('https://mabbox.bytel.fr/api/v1/hosts', function(err, res, body) {
        if (!error && res.statusCode == 200) {
          this.devices = {};

          JSON.parse(body)[0].hosts.list.forEach(x => {
            this.devices[x.id] = x;
            this.addAccessory(x.hostname, x.id);
          });

          if (this.isUnreachable) {
            this.accessories.forEach(x => {
              x.reachable = true;
              x.updateReachability();
            });
          }
        }
        else {
          this.isUnreachable = true;
          this.accessories.forEach(x => {
            x.reachable = false;
            x.updateReachability();
          });
        }
      }.bind(this));

    }, 2000);

    if (!api) return;
    this.api = api;
    
    this.api.on('didFinishLaunching', function() {
      platform.log("DidFinishLaunching");
    }.bind(this));
  }

  configureAccessory (accessory) {
    this.log(accessory.name, "Configure Accessory");

    var platform = this;

    // Set the accessory to reachable if plugin can currently process the accessory,
    // otherwise set to false and update the reachability later by invoking
    // accessory.updateReachability()
    accessory.reachable = true;

    accessory.on('identify', function(paired, callback) {
      platform.log(accessory.name, "Identify!!!");
      callback();
    });

    if (accessory.getService(Service.ContactSensor)) {
      accessory.getService(Service.ContactSensor)
      .getCharacteristic(Characteristic.On)
      .on('get', platform.isOnline.bind(this));
    }

    this.accessories.push(accessory);
  }

  addAccessory(accessoryName, id) {
    this.log(accessoryName, "Adding Accessory");

    let platform = this;

    var accessory = new Accessory(accessoryName, UUIDGen.generate(id));
    accessory.on('identify', function(paired, callback) {
      platform.log(accessory.name, "Identifying");
      callback();
    });

    accessory.context.id = id;
    // Plugin can save context on accessory to help restore accessory in configureAccessory()
    // accessory.context.something = "Something"

    // Make sure you provided a name for service, otherwise it may not visible in some HomeKit apps
    accessory.addService(Service.ContactSensor, 'Connecté')
    .getCharacteristic(Characteristic.On)
    .on('get', cb => platform.isOnline.bind(this, platform, cb));

    this.accessories.push(accessory);
    this.api.registerPlatformAccessories('homebridge-bbox', "BboxPlatform", [accessory]);
  }

  removeAccessory() {
    this.log("Remove Accessory");
    this.api.unregisterPlatformAccessories('homebridge-bbox', "BboxPlatform", this.accessories);

    this.accessories = [];
  }

  isOnline(platform, callback) {
    platform.log(accessory.name, "Trigger isOnline -> " + value);

    this.context.online = platform.devices[this.context.id].lastseen == '-1';

    this.log(`calling isOnline`, this.context.online);
    callback(null, this.context.online);
  }
};
