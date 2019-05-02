'use strict'

const request = require('request');
const wol = require('wake_on_lan');

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
              let accessory = this.addAccessory(x.hostname || `Device #${x.id}`, x.macaddress);
              if (!accessory) return;

              this.devices[x.macaddress] = x;

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

    this.log(accessory.displayName, "Configure Accessory");

    var platform = this;

    if (platform.config.devicesToShow && !platform.config.devicesToShow.includes(accessory.displayName) && !platform.config.devicesToShow.includes(accessory.context.id))
    {
      accessory.reachable = false;
      this.accessories.push(accessory);

      return accessory;
    }
    else accessory.reachable = true;

    accessory.on('identify', function(paired, callback) {
      platform.log(accessory.displayName, "Identifying");
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

    if (accessory.getService(Service.Switch)) {
      accessory.getService(Service.Switch)
      .getCharacteristic(Characteristic.StatusActive)
      .on('get', cb => cb(null, false))
      .on('set', cb => {
        this.log(accessory.displayName, 'wake on lan trigger');
        this.wake.bind(accessory, this, cb);
      });
    }

    let conf = this.config.devicesConfig[accessory.context.id];
    if (conf && conf.name) accessory.displayName = conf.name;

    let accessoryInformationService = accessory.getService(Service.AccessoryInformation) || accessory.addService(Service.AccessoryInformation);

    accessoryInformationService
    .setCharacteristic(Characteristic.Name, accessory.displayName)
    .setCharacteristic(Characteristic.Manufacturer, 'Ryzzzen')
    .setCharacteristic(Characteristic.Model, 'homebridge-bbox')
    .setCharacteristic(Characteristic.SerialNumber, accessory.context.id);

    this.accessories.push(accessory);
  }

  addAccessory(accessoryName, id, conf = this.config.devicesConfig, options = { device: true, features: ['online'] }) {
    const UUID = UUIDGen.generate(id);
    let accessory = this.accessories.find(x => x.UUID === UUID);

    if (accessory)
      return accessory;

    if (this.config.devicesToShow && !this.config.devicesToShow.includes(accessoryName) && !this.config.devicesToShow.includes(id))
      return;

    this.log(accessoryName, "Adding Accessory");

    accessory = new Accessory(accessoryName, UUID);

    if (conf[id] && conf[id].name) accessory.displayName = conf[id].name;
    else accessory.displayName = accessoryName;

    accessory.on('identify', function(paired, callback) {
      this.log(accessory.displayName, "Identifying");
      callback();
    });

    accessory.context.id = id;

    let features = conf[id] && conf[id].features ? conf[id].features : options.features;
    if (options.device) {
      if (features.includes('online')) {
        accessory.addService(Service.ContactSensor, accessoryName + ': présent')
        .getCharacteristic(Characteristic.StatusActive)
        .on('get', cb => {
          this.log(accessory.displayName, "isOnline");
          this.isOnline.bind(accessory, this, cb);
        });
      }

      if (features.includes('wakeonlan')) {
        accessory.addService(Service.Switch, accessoryName + ': ')
        .getCharacteristic(Characteristic.On)
        .on('get', cb => cb(null, false))
        .on('set', cb => {
          this.log(accessory.displayName, 'wake on lan trigger');
          this.wake.bind(accessory, this, cb);
        });
      }
    }

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
    this.context.online = platform.devices[this.context.id].active == 1;
    platform.log(accessory.displayName, "Trigger isOnline -> " + this.context.online);

    this.log(`calling isOnline`, this.context.online);
    callback(null, this.context.online);
  }

  wake(platform, callback) {
    platform.log(accessory.displayName, "Triggered wake -> " + value);
    console.dir(this);

    wol.wake(this.context.id, err => {
      if (err) return callback(err);

      callback(null, false);
    });
  }
};
