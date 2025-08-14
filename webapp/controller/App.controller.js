sap.ui.define(
    [
        "sap/ui/core/mvc/Controller"
    ],
    function(BaseController) {
      "use strict";
  
      return BaseController.extend("ventilado.ventiladoptl.controller.App", {
        onInit() {
        },
         onToggleClock: function () {
          const oClockModel = this.getView().getModel("clock");
          const elapsedSeconds = oClockModel.getProperty("/elapsedSeconds");
          const isRunning = oClockModel.getProperty("/isRunning");

          if (elapsedSeconds === 0 && !isRunning) {
              // Si es la primera vez, inicia el cronómetro
              oClockModel.setProperty("/isRunning", true);
          } else {
              // Conmutar entre Pausar y Reanudar
              oClockModel.setProperty("/isRunning", !isRunning);
          }
          // Guardar estado en localStorage
            localStorage.setItem("clockData", JSON.stringify(oClockModel.getData()));
      },
      onResetClock: function () {
        const oClockModel = this.getView().getModel("clock");
        oClockModel.setProperty("/elapsedSeconds", 0);
        oClockModel.setProperty("/time", "00:00:00");
        oClockModel.setProperty("/isRunning", false); 
      },
      
      });
    }
  );
  