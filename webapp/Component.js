/**
 * eslint-disable @sap/ui5-jsdocs/no-jsdoc
 */

sap.ui.define(
  [
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "ventilado/ventiladoptl/model/models",
    "sap/ui/model/json/JSONModel",
  ],
  function (UIComponent, Device, models, JSONModel) {
    "use strict";

    return UIComponent.extend("ventilado.ventiladoptl.Component", {
      metadata: {
        manifest: "json",
      },

      /**
       * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
       * @public
       * @override
       */
      init: function () {
        // call the base component's init function
        UIComponent.prototype.init.apply(this, arguments);

        // Crear un modelo para gestionar el estado de autenticación
        var oAuthModel = new JSONModel({
          isLoggedIn: false,
        });
        this.setModel(oAuthModel, "auth");

        // enable routing
        this.getRouter().initialize();

        // set the device model
        this.setModel(models.createDeviceModel(), "device");

        // Crear el modelo global
        var oDate = new Date();
        var oFormattedDate = this._formatDate(oDate);

        var oGlobalModel = new JSONModel({
          puesto: "",
          reparto: "",
          operador: "",
          fecha: oFormattedDate,
          cantidad: "",
          ruta: "",
        });

        // Establecer el modelo global en el componente para que esté disponible globalmente
        this.setModel(oGlobalModel, "globalModel");

        // Recuperar datos guardados
        const storedClock = localStorage.getItem("clockData");

        let clockData = {
          time: "00:00:00",
          isRunning: false,
          elapsedSeconds: 0,
        };

        if (storedClock) {
          clockData = JSON.parse(storedClock);
        }

        const oClockModel = new JSONModel(clockData);
        this.setModel(oClockModel, "clock");

        // NUEVO COMPORTAMIENTO: El cronómetro nunca se inicia automáticamente
        // Solo se actualiza cuando se hacen creates de zlog_ventilado
        // Siempre asegurar que isRunning sea false
        oClockModel.setProperty("/isRunning", false);
      },

      _formatDate: function (oDate) {
        var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
          pattern: "yyyy-MM-dd",
        });
        return oDateFormat.format(oDate);
      },
      _startClockTimer: function (oClockModel) {
        if (this._clockInterval) {
          clearInterval(this._clockInterval);
        }

        this._clockInterval = setInterval(() => {
          let elapsed = oClockModel.getProperty("/elapsedSeconds") + 1;
          oClockModel.setProperty("/elapsedSeconds", elapsed);

          let h = Math.floor(elapsed / 3600);
          let m = Math.floor((elapsed % 3600) / 60);
          let s = elapsed % 60;

          let timeStr = [h, m, s]
            .map((v) => v.toString().padStart(2, "0"))
            .join(":");
          oClockModel.setProperty("/time", timeStr);

          // Guardar estado en localStorage
          localStorage.setItem(
            "clockData",
            JSON.stringify(oClockModel.getData())
          );
        }, 1000);
      },
      stopClockAndClearStorage: function () {
        // Detener intervalo si está corriendo
        if (this._clockInterval) {
          clearInterval(this._clockInterval);
          this._clockInterval = null;
        }

        const oClockModel = this.getModel("clock");
        // Reiniciar modelo a cero
        oClockModel.setData({
          time: "00:00:00",
          isRunning: false,
          elapsedSeconds: 0,
        });
        // Marcar como detenido (sin reiniciar tiempo)
        oClockModel.setProperty("/isRunning", false);
        // Eliminar datos guardados
        localStorage.removeItem("clockData");
      },
    });
  }
);
