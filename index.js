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
              let accessory = this.addAccessory(x.hostname || `Device #${x.id}`, x.macaddress);

              accessory
              .getService(Service.ContactSensor)
              .getCharacteristic(Characteristic.ContactSensorState)
              .setValue(x.active === 1);
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
    console.dir(accessory);

    this.log(accessory.name, "Configure Accessory");

    var platform = this;

    if (platform.config.devicesToShow && !platform.config.devicesToShow.includes(accessory.name) && !platform.config.devicesToShow.includes(accessory.context.id))
    {
      accessory.reachable = false;
      this.accessories.push(accessory);

      return accessory;
    }
    else accessory.reachable = true;

    accessory.on('identify', function(paired, callback) {
      platform.log(accessory.name, "Identifying");
      callback();
    });

    if (accessory.getService(Service.ContactSensor)) {
      accessory.getService(Service.ContactSensor)
      .getCharacteristic(Characteristic.StatusActive)
      .on('get', cb => {
        this.log(accessory.displayName, "isOnline");
        this.isOnline.bind(accessory, this, cb);
      });
    }

    let conf = this.config.devicesConfig[accessory.context.id];
    if (conf && conf.name) accessory.displayName = accessory.name = conf.name;

    let accessoryInformationService = accessory.getService(Service.AccessoryInformation) || accessory.addService(Service.AccessoryInformation);

    accessoryInformationService
    .setCharacteristic(Characteristic.Name, accessory.displayName)
    .setCharacteristic(Characteristic.Manufacturer, 'Ryzzzen')
    .setCharacteristic(Characteristic.Model, 'homebridge-bbox')
    .setCharacteristic(Characteristic.SerialNumber, accessory.context.id);

    this.accessories.push(accessory);
  }

  addAccessory(accessoryName, id, conf = this.config.devicesConfig) {
    const UUID = UUIDGen.generate(id);
    let accessory = this.accessories.find(x => x.UUID === UUID);

    if (accessory)
      return accessory;

    if (this.config.devicesToShow && !this.config.devicesToShow.includes(accessoryName) && !this.config.devicesToShow.includes(id))
      return;

    this.log(accessoryName, "Adding Accessory");

    accessory = new Accessory(accessoryName, UUID);

    if (conf[id] && conf[id].name) accessory.displayName = accessory.name = conf[id].name;
    else accessory.displayName = accessory.name = accessoryName;

    accessory.on('identify', function(paired, callback) {
      this.log(accessory.name, "Identifying");
      callback();
    });

    accessory.context.id = id;

    accessory.addService(Service.ContactSensor, accessoryName + ': présent')
    .getCharacteristic(Characteristic.StatusActive)
    .on('get', cb => {
      this.log(accessory.displayName, "isOnline");
      this.isOnline.bind(accessory, this, cb);
    });

    let accessoryInformationService = accessory.getService(Service.AccessoryInformation) || accessory.addService(Service.AccessoryInformation);

    accessoryInformationService
    .setCharacteristic(Characteristic.Name, accessory.displayName)
    .setCharacteristic(Characteristic.Manufacturer, 'Ryzzzen')
    .setCharacteristic(Characteristic.Model, 'homebridge-bbox')
    .setCharacteristic(Characteristic.SerialNumber, id);

    this.accessories.push(accessory);
    this.api.registerPlatformAccessories('homebridge-bbox', "BboxPlatform", [accessory]);

    return accessory;
  }

  removeAccessory() {
    this.log("Remove Accessory");
    this.api.unregisterPlatformAccessories('homebridge-bbox', "BboxPlatform", this.accessories);

    this.accessories = [];
  }

  isOnline(platform, callback) {
    platform.log(accessory.name, "Trigger isOnline -> " + value);

    console.dir(platform.devices[this.context.id].active)
    this.context.online = platform.devices[this.context.id].active == 1;

    this.log(`calling isOnline`, this.context.online);
    callback(null, this.context.online);
  }
};
