'use strict'

const request = require('request');

let Accessory, Service, Characteristic, UUIDGen;

module.exports = homebridge => {
  Accessory = homebridge.platformAccessory;

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

    if (!api) return;
    this.api = api;

    this.api.on('didFinishLaunching', () => {
      setInterval(() => {
        request('https://mabbox.bytel.fr/api/v1/hosts', function(err, res, body) {
          if (!err && res.statusCode == 200) {
            this.devices = {};

            JSON.parse(body)[0].hosts.list.forEach(x => {
              this.devices[x.macaddress] = x;
              this.addAccessory(x.hostname || `Device #${x.id}`, x.macaddress);
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
    });
  }

  configureAccessory (accessory) {
    this.log(accessory.name, "Configure Accessory");

    var platform = this;

    if (platform.config.devicesToShow && !platform.config.devicesToShow.includes(accessory.name) && !platform.config.devicesToShow.includes(accessory.context.id))
      return accessory.reachable = false;
    else accessory.reachable = true;

    accessory.on('identify', function(paired, callback) {
      platform.log(accessory.name, "Identifying");
      callback();
    });

    if (accessory.getService(Service.ContactSensor)) {
      accessory.getService(Service.ContactSensor)
      .getCharacteristic(Characteristic.StatusActive)
      .on('get', platform.isOnline.bind(this));
    }

    this.accessories.push(accessory);
  }

  addAccessory(accessoryName, id) {
    const UUID = UUIDGen.generate(id);

    if (platform.accessories.some(x => x.UUID === UUID))
      return;

    if (platform.config.devicesToShow && !platform.config.devicesToShow.includes(accessoryName) && !platform.config.devicesToShow.includes(id))
      return;

    this.log(accessoryName, "Adding Accessory");

    let platform = this;

    let accessory = new Accessory(accessoryName, UUID), conf = platform.config.devicesConfig[id];

    if (conf.name) accessory.displayName = accessory.name = conf.name;
    else accessory.displayName = accessory.name = accessoryName;

    accessory.on('identify', function(paired, callback) {
      platform.log(accessory.name, "Identifying");
      callback();
    });

    accessory.context.id = id;
    // Plugin can save context on accessory to help restore accessory in configureAccessory()
    // accessory.context.something = "Something"

    // Make sure you provided a name for service, otherwise it may not visible in some HomeKit apps
    accessory.addService(Service.ContactSensor, accessoryName + ': présent')
    .getCharacteristic(Characteristic.StatusActive)
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
