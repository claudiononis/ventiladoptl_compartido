sap.ui.define(
  [
    "sap/ui/core/UIComponent",
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator", // Importar BusyIndicator
    "sap/ui/model/odata/v2/ODataModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
  ],
  function (
    UIComponent,
    Controller,
    MessageToast,
    MessageBox,
    BusyIndicator,
    ODataModel,
    Filter,
    FilterOperator,
    Fragment,
    JSONModel
  ) {
    "use strict";
    var ctx;
    var sPreparador;
    var sTransporte;
    var PTL_API_URL = localStorage.getItem("IpApi");
    var sPtoPlanif;
    var sPuesto;
    var sFecha;
    let todasLasRutasAsignadas = false;

    return Controller.extend("ventilado.ventiladoptl.controller.View1", {
      onInit: function () {
        // Cargar límites desde localStorage o usar por defecto
        const oView = this.getView();
        const limite1 = localStorage.getItem("limite1");
        const limite2 = localStorage.getItem("limite2");
        const usarRoll = localStorage.getItem("usarRoll");

        oView.byId("limite1").setValue(limite1 !== null ? limite1 : "8");
        oView.byId("limite2").setValue(limite2 !== null ? limite2 : "12");
        oView.byId("usarRoll").setSelected(usarRoll === "true");

        this._dbConnections = []; // Array para almacenar conexiones abiertas
        var oDate = new Date();
        var oFormattedDate = this._formatDate(oDate);
        var oFechaInput = this.byId("fecha"); // Asegúrate de que el ID del campo de entrada sea "fechaInput"

        if (oFechaInput) {
          oFechaInput.setValue(oFormattedDate);
        }

        sFecha =
          sessionStorage.getItem("fecha") ||
          new Date().toISOString().slice(0, 10);

        // Obtener el router y añadir la función para el evento routeMatched
        var oRouter = UIComponent.getRouterFor(this);
        oRouter
          .getRoute("RouteView1")
          .attachPatternMatched(this.onRouteMatched, this);

        const oConfigModel = new sap.ui.model.json.JSONModel({
          listaDisplaysCol1: [],
          listaDisplaysCol2: [],
          displaysDesactivados: [],
        });
        this._actualizarIndicadorDisplaysMarcados();
        this.getView().setModel(oConfigModel, "configModel");
        this._cargarDepositos();
        if (localStorage.getItem("estacionId")) {
          this._rellenarDatosFijos();
          return;
        }
        // Caso contrario, cargar la lista de depósitos

        // 2) Modelo “view” para datos de la propia pantalla
        const oViewModel = new sap.ui.model.json.JSONModel({
          depositoSel: "", // aquí guardaremos la selección
        });
      },

      onRouteMatched: function (oEvent) {
        this._dbConnections = []; // Array para almacenar conexiones abiertas
        var aInputs = [
          this.byId("puesto"),
          this.byId("reparto"),
          this.byId("pto_planif"),
          this.byId("Usuario"),
        ];

        var bValid = true;

        // Validar todos los campos requeridos
        aInputs.forEach(function (oInput) {
          if (!oInput.getValue()) {
            // oInput.setValueState("Error");
            bValid = false;
          } else {
            oInput.setValueState("None");
          }
        });
        if (localStorage.getItem("Actualizar") == "true" && bValid) {
          localStorage.setItem("Actualizar", false);
          this.onBuscarPress();
        }
        //  this.verificarAsignacionDeDisplays();
        this._actualizarIndicadorDisplaysMarcados();
        // Lee los valores de localStorage
        var sTransporte = localStorage.getItem("transporte");
        var sOperador = localStorage.getItem("operador");
        var sOrigen = localStorage.getItem("origen");

        if (sOrigen === "logtransporte") {
          this.getView().byId("reparto").setValue(sTransporte);
          this.getView().byId("Usuario").setValue(sOperador);
          this.getView().byId("pto_planif").setValue("2700");
        }
      },

      _formatDate: function (date) {
        var day = String(date.getDate()).padStart(2, "0");
        var month = String(date.getMonth() + 1).padStart(2, "0"); // Enero es 0
        var year = date.getFullYear();
        return day + "/" + month + "/" + year;
      },

      onScanPress: function () {
        this.onExit();
        const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter.navTo("Scan");
      },

      onLogTransporte: function () {
        this.onExit();
        const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter.navTo("Logtransporte");
      },
      onDesconsolidadoPress: function () {
        this.onExit();
        const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter.navTo("Desconsolidado");
      },
      onCierrePress: function () {
        this.onExit();
        const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter.navTo("Cierre");
      },
      onLogPress: function () {
        this.onExit();
        const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter.navTo("Log");
      },
      onAvancePPress: function () {
        this.onExit();
        const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        // oRouter.navTo("Avance");
        oRouter.navTo("Avanceporci");
      },
      onAvanceRutaPress: function () {
        this.onExit();
        const oView = this.getView();
        const limite1 = parseInt(oView.byId("limite1").getValue(), 10);
        const limite2 = parseInt(oView.byId("limite2").getValue(), 10);
        const usarRoll = oView.byId("usarRoll").getSelected();
        localStorage.setItem("limite1", isNaN(limite1) ? "8" : limite1);
        localStorage.setItem("limite2", isNaN(limite2) ? "12" : limite2);
        localStorage.setItem("usarRoll", usarRoll ? "true" : "false");
        const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter.navTo("Avance2");
      },

      /*  Cuando se pulsa "Buscar datos" se ejecuta esta funcion
            Se busca el modelo y se llama a la "Function import" del back end para buscar los datos  del transporte
            a ventilar.           
        */
      onBuscarPress: function () {
        this.closeAllDbConnections();
        // Guardar los valores en sessionStorage
        sTransporte = this.getView()
          .byId("reparto")
          .getValue()
          .padStart(10, "0");
        sPtoPlanif = this.getView()
          .byId("pto_planif")
          .getValue()
          .padStart(4, "0");
        sPuesto = this.getView().byId("puesto").getValue();
        sPreparador = this.getView().byId("Usuario").getValue();

        // Guardar datos
        localStorage.setItem("sPuesto", sPuesto);
        localStorage.setItem("sReparto", sTransporte);
        localStorage.setItem("sPtoPlanif", sPtoPlanif);
        localStorage.setItem("sPreparador", sPreparador);
        localStorage.setItem("Actualizar", false);

        /*         var aInputs = [
                  this.byId("puesto"),
                  this.byId("reparto"),
                  this.byId("pto_planif"),
                  this.byId("Usuario"),
                ]; */

        var sOrigen = localStorage.getItem("origen");

        // Si vienes de logtransporte, no incluyas "puesto" en la validación
        var aInputs;
        if (sOrigen === "logtransporte") {
          aInputs = [
            this.byId("reparto"),
            this.byId("pto_planif"),
            this.byId("Usuario"),
          ];
        } else {
          aInputs = [
            this.byId("puesto"),
            this.byId("reparto"),
            this.byId("pto_planif"),
            this.byId("Usuario"),
          ];
        }

        var bValid = true;

        // Validar todos los campos requeridos
        aInputs.forEach(function (oInput) {
          if (!oInput.getValue()) {
            oInput.setValueState("Error");
            bValid = false;
          } else {
            oInput.setValueState("None");
          }
        });

        if (bValid) {
          // Mostrar
          this.onExit();
          BusyIndicator.show(0);
          // Todos los campos requeridos están llenos, buscar datos
          this.buscarDatos();
        } else {
          MessageBox.error(
            "ERROR. Por favor, complete todos los campos obligatorios.",
            {
              title: "Error ",
              styleClass: "customMessageBox", // Aplica la clase CSS personalizada
              onClose: function () {
                console.log("Mensaje de error personalizado cerrado.");
              },
            }
          );
        }
      },

      buscarDatos: function () {
        var ctx = this;
        var oModel = new sap.ui.model.odata.v2.ODataModel(
          "/sap/opu/odata/sap/ZVENTILADO_SRV/",
          {
            useBatch: false,
            defaultBindingMode: "TwoWay",
            deferredGroups: ["batchGroup1"],
          }
        );
        oModel.refreshMetadata();
        sTransporte = ctx
          .getView()
          .byId("reparto")
          .getValue()
          .padStart(10, "0");
        var sOperador = ctx.getView().byId("Usuario").getValue();
        var sPuesto = ctx.getView().byId("puesto").getValue();
        var sPtoPlanificacion = ctx.getView().byId("pto_planif").getValue();

        //actualizo datos globales
        var oGlobalModel = this.getOwnerComponent().getModel("globalModel");
        if (oGlobalModel) {
          oGlobalModel.setProperty("/puesto", sPuesto);
          oGlobalModel.setProperty("/reparto", sTransporte);
        }
        oModel.callFunction("/GenerarTransporte", {
          // se llama a la function import
          method: "GET",
          urlParameters: {
            transporte: sTransporte, // pasa los parametros strings
            pto_planificacion: sPtoPlanificacion,
          },
          success: function (oData) {
            // Manejar éxito
            MessageToast.show("Se cargaron los datos para el ventilado");
            // Procesar la respuesta aquí
            var transporte = oData.Transporte;
            transporte = transporte.padStart(10, "0");
            var entrega = oData.Entrega;
            var pto_planificacion = oData.Pto_planificacion;
            var estado = oData.Ean;
            // Aquí se puede  trabajar con los datos recibidos
            console.log("Transporte: ", transporte);
            console.log("Pto Entrega: ", pto_planificacion);
            console.log("Entrega: ", entrega);
            console.log("Estado: ", estado);
            // leer datos del Transporte a  ventilar
            // y los guarda en la base local
            ctx._fetchAndStoreOData();
          },
          error: function (oError) {
            // Manejar error
            var sErrorMessage = "";
            try {
              var oErrorResponse = JSON.parse(oError.responseText);
              sErrorMessage = oErrorResponse.error.message.value;
            } catch (e) {
              sErrorMessage =
                "Error desconocido,  revise conexion de Internet y VPN";
            }
            BusyIndicator.hide(); // Ocultar
            MessageBox.information(sErrorMessage, {
              title: "Informacion",
              actions: [MessageBox.Action.OK],
              onClose: function () {
                // Aquí puedes agregar lógica adicional si lo necesitas
              },
            }); //           MessageToast.show(sErrorMessage);
          },
          timeout: 10000, // Establecer un tiempo de espera de 10 segundos
        });
      },

      _fetchAndStoreOData: function () {
        var ctx = this;
        var request = indexedDB.deleteDatabase("ventilado");

        request.onerror = function (event) {
          console.error(
            "Error al borrar la base de datos:",
            event.target.errorCode
          );
        };

        request.onblocked = function (event) {
          console.warn(
            "La base de datos no se pudo borrar porque otra conexión aún está abierta."
          );
          BusyIndicator.hide(); // Ocultar
        };

        request.onsuccess = function (event) {
          console.log("Base de datos borrada con éxito.");

          // Después de borrar la base de datos, abrirla de nuevo
          var openRequest = indexedDB.open("ventilado", 5);

          openRequest.onerror = function (event) {
            console.error(
              "Error al abrir la base de datos:",
              event.target.errorCode
            );
            BusyIndicator.hide(); // Ocultar
          };

          openRequest.onupgradeneeded = function (event) {
            var db = event.target.result;
            var objectStore = db.createObjectStore("ventilado", {
              keyPath: "Id",
            });

            objectStore.createIndex("Ean", "Ean", { unique: false });
            objectStore.createIndex("Fecha", "Fecha", { unique: false });
            objectStore.createIndex("Transporte", "Transporte", {
              unique: false,
            });
            objectStore.createIndex("Entrega", "Entrega", { unique: false });
            objectStore.createIndex(
              "NombreDestinatario",
              "NombreDestinatario",
              { unique: false }
            );
            objectStore.createIndex("Calle", "Calle", { unique: false });
            objectStore.createIndex(
              "Lugar_destinatario",
              "Lugar_destinatario",
              { unique: false }
            );
            objectStore.createIndex("CodigoInterno", "CodigoInterno", {
              unique: false,
            });
            objectStore.createIndex("Descricion", "Descricion", {
              unique: false,
            });
            objectStore.createIndex("CantidadEntrega", "CantidadEntrega", {
              unique: false,
            });
            objectStore.createIndex("LugarPDisp", "LugarPDisp", {
              unique: false,
            });
            objectStore.createIndex("Preparador", "Preparador", {
              unique: false,
            });
            objectStore.createIndex("Estado", "Estado", { unique: false });
            objectStore.createIndex("Cubre", "Cubre", { unique: false });
            objectStore.createIndex("Pa", "Pa", { unique: false });
            objectStore.createIndex("AdicChar1", "AdicChar1", {
              unique: false,
            });
          };

          openRequest.onsuccess = function (event) {
            ctx.db = event.target.result;
            ctx._dbConnections.push(ctx.db); // Guardar referencia a la conexión abierta
            console.log("Base de datos abierta con éxito.");

            var oModel = new ODataModel("/sap/opu/odata/sap/ZVENTILADO_SRV/");
            //Se leen los datos del backend filtrando por el numero de transporte
            // Configurar los filtros
            var aFilters = [];
            aFilters.push(
              new Filter("Transporte", FilterOperator.EQ, sTransporte)
            );
            oModel.read("/ventiladoSet", {
              filters: aFilters,
              success: function (oData) {
                var transaction = ctx.db.transaction(
                  ["ventilado"],
                  "readwrite"
                );
                var objectStore = transaction.objectStore("ventilado");

                // Verificar si oData.results es un array
                if (Array.isArray(oData.results)) {
                  oData.results.sort(function (a, b) {
                    if (a.CodigoInterno === b.CodigoInterno) {
                      // Convertir LugarPDisp a número para una correcta comparación
                      return (
                        parseInt(a.LugarPDisp, 10) - parseInt(b.LugarPDisp, 10)
                      );
                    }
                    return a.CodigoInterno.localeCompare(b.CodigoInterno);
                  });
                  // Si es un array, iterar sobre cada item
                  oData.results.forEach(function (item) {
                    // Completando el campo "Transporte" con ceros a la izquierda si es necesario
                    item.Transporte = (item.Transporte || "").padStart(10, "0");

                    // Guardar el item en el object store, primero elimina de LugarPDisp los ceros a la izquierda
                    var lugarPDisp = item.LugarPDisp;

                    // Eliminar ceros a la izquierda usando replace
                    lugarPDisp = lugarPDisp.replace(/^0+/, "");

                    // Asignar de nuevo el valor sin ceros a la izquierda
                    item.LugarPDisp = lugarPDisp;
                    objectStore.put(item);
                  });
                } else {
                  // Si no es un array, manejar el único item directamente
                  var item = oData.results;
                  // Completando el campo "Transporte" con ceros a la izquierda si es necesario
                  item.Transporte = (item.Transporte || "").padStart(10, "0");
                  // Guardar el item en el object store
                  objectStore.put(item);
                }
                BusyIndicator.hide(); // Ocultar
                /*   ctx.verificarAsignacionDeDisplays();
                              console.log("Datos copiados con éxito."); */ //
                ctx._verificarAsignacionYRedirigir();
                console.log("Datos copiados con éxito.");

                if (ctx.todosEstadoInicial()) {
                  const totalCantidadEntrega = oData.results.reduce(
                    (sum, item) =>
                      sum + (parseFloat(item.CantidadEntrega) || 0),
                    0
                  );

                  // Contar valores únicos de Ean
                  const uniqueEans = new Set(
                    oData.results.map((item) => item.Ean)
                  );
                  const cantidadEansUnicos = uniqueEans.size;

                  const oClockModel = ctx.getOwnerComponent().getModel("clock");
                  oClockModel.setProperty("/isRunning", true);
                  localStorage.setItem(
                    "clockData",
                    JSON.stringify(oClockModel.getData())
                  );
                  ctx.getOwnerComponent()._startClockTimer(oClockModel);

                  // Insertar un nuevo registro en el backend
                  var oModel = new sap.ui.model.odata.v2.ODataModel(
                    "/sap/opu/odata/sap/ZVENTILADO_SRV/",
                    {
                      useBatch: false,
                      defaultBindingMode: "TwoWay",
                      deferredGroups: ["batchGroup1"],
                    }
                  );
                  var sTransporte = ctx
                    .byId("reparto")
                    .getValue()
                    .padStart(10, "0");

                  var sPtoPlanif = ctx.byId("pto_planif").getValue().trim();
                  var sTipoLog = "INICIO";

                  // Primero, buscar si ya existe el registro
                  var aFilters = [
                    new sap.ui.model.Filter(
                      "Transporte",
                      sap.ui.model.FilterOperator.EQ,
                      sTransporte
                    ),
                    new sap.ui.model.Filter(
                      "TipoLog",
                      sap.ui.model.FilterOperator.EQ,
                      sTipoLog
                    ),
                  ];
                  oModel.read("/zlog_ventiladoSet", {
                    filters: aFilters,
                    success: function (oData) {
                      if (oData.results && oData.results.length === 0) {
                        // No existe, entonces hago el create
                        var now = new Date();

                        // Edm.Time formato OData: PTxxHxxMxxS
                        function toODataTime(timeStr) {
                          var parts = timeStr.split(":");
                          return (
                            "PT" +
                            parts[0] +
                            "H" +
                            parts[1] +
                            "M" +
                            parts[2] +
                            "S"
                          );
                        }
                        var sODataFechaInicio = "/Date(" + now.getTime() + ")/";
                        var sODataFechaFin =
                          "/Date(" +
                          new Date(1900, 0, 1, 0, 0, 0).getTime() +
                          ")/";
                        var sHoraActual = now.toTimeString().slice(0, 8); // "HH:MM:SS"
                        var sODataHoraFin = toODataTime("00:00:00");
                        var sODataHoraInicio = toODataTime(sHoraActual);
                        localStorage.setItem("HoraInicio", sODataHoraInicio);
                        var centroValue =
                          localStorage.getItem("depositoCod") || "";
                        var preparadorValue =
                          localStorage.getItem("sPreparador") || "";
                        var entregaValue =
                          localStorage.getItem("sPtoPlanif") || "";
                        var oEntry = {
                          Id: 0,
                          EventoNro: 0,
                          ScanNro: 0,
                          Ean: "",
                          CodigoInterno: "",
                          Descripcion: "",
                          Ruta: "",
                          TipoLog: sTipoLog,
                          Hora: sODataHoraInicio,
                          Fecha: sODataFechaInicio,
                          Preparador: ctx.byId("Usuario").getValue(),
                          Cliente: "",
                          Entrega: entregaValue,
                          Centro: centroValue,
                          Preparador: preparadorValue,
                          Estacion: ctx.byId("puesto").getValue(),
                          Transporte: sTransporte,
                          CantAsignada: 0,
                          ConfirmadoEnRuta: "",
                        };

                        // Primer create: zlog_ventiladoSet
                        var oModel = new sap.ui.model.odata.v2.ODataModel(
                          "/sap/opu/odata/sap/ZVENTILADO_SRV/"
                        );
                        oModel.create("/zlog_ventiladoSet", oEntry, {
                          success: function (data) {
                            var oClockModel = ctx
                              .getOwnerComponent()
                              .getModel("clock");
                            oClockModel.setProperty("/time", "00:00:00");
                            oClockModel.setProperty("/elapsedSeconds", 0);
                            oClockModel.setProperty("/isRunning", true);
                            localStorage.setItem(
                              "clockData",
                              JSON.stringify(oClockModel.getData())
                            );
                            ctx
                              .getOwnerComponent()
                              ._startClockTimer(oClockModel);
                          },
                          error: function (err) {
                            MessageBox.error("Error al crear el evento.");
                          },
                        });

                        // Segundo create: ZVENTILADO_KPISet
                        var oEntryKPI = {
                          Estacion: ctx.byId("puesto").getValue(),
                          Transporte: ctx
                            .byId("reparto")
                            .getValue()
                            .padStart(10, "0"),
                          Entrega: "",
                          Fechainicio: sODataFechaInicio,
                          Horainicio: sODataHoraInicio,
                          Fechafin: sODataFechaFin,
                          Horafin: sODataHoraFin,
                          Duracionneta: 0,
                          Cantidadentrega: 0,
                          Operador: ctx.byId("Usuario").getValue(),
                          Cantidaditem: totalCantidadEntrega,
                          Campoadicional3: "",
                          Cantidadcubeta: 0,
                          Cantidadpallet: 0,
                          Cantidadroll: 0,
                          Volumenentrega: "",
                          Kiloentrega: "",
                          Duracionpreparacion: 0,
                          Duracionfinal: 0,
                          Inicioescaneo: sODataHoraFin,
                          Iniciodesafectacion: sODataHoraFin,
                          Cantidadean: cantidadEansUnicos,
                          Campoadicional1: "PTL",
                          Campoadicional2: sPtoPlanif,
                        };

                        oModel.create("/ZVENTILADO_KPISet", oEntryKPI, {
                          success: function (data) {
                            MessageToast.show("KPI creado correctamente.");
                            // Validar y actualizar cronómetro si horainicio > 0
                            ctx._validarYActualizarCronometro();
                          },
                          error: function (err) {
                            MessageBox.error("Error al crear registro KPI.");
                          },
                        });
                      } else {
                        var oModel = new sap.ui.model.odata.v2.ODataModel(
                          "/sap/opu/odata/sap/ZVENTILADO_SRV/",
                          {
                            useBatch: false,
                            defaultBindingMode: "TwoWay",
                            deferredGroups: ["batchGroup1"],
                          }
                        );

                        // Crear registro BUSC.DATOS para transporte existente
                        var now = new Date();
                        function toODataTime(timeStr) {
                          var parts = timeStr.split(":");
                          return (
                            "PT" +
                            parts[0] +
                            "H" +
                            parts[1] +
                            "M" +
                            parts[2] +
                            "S"
                          );
                        }
                        var sODataFechaInicio = "/Date(" + now.getTime() + ")/";
                        var sHoraActual = now.toTimeString().slice(0, 8); // "HH:MM:SS"
                        var sODataHoraInicio = toODataTime(sHoraActual);
                        var centroValue =
                          localStorage.getItem("depositoCod") || "";
                        var preparadorValue =
                          localStorage.getItem("sPreparador") || "";
                        var entregaValue =
                          localStorage.getItem("sPtoPlanif") || "";

                        var oEntryBuscDatos = {
                          Id: 0,
                          EventoNro: 0,
                          ScanNro: 0,
                          Ean: "",
                          CodigoInterno: "",
                          Descripcion: "",
                          Ruta: "",
                          TipoLog: "BUSC.DATOS",
                          Hora: sODataHoraInicio,
                          Fecha: sODataFechaInicio,
                          Preparador: ctx.byId("Usuario").getValue(),
                          Cliente: "",
                          Entrega: entregaValue,
                          Centro: centroValue,
                          Preparador: preparadorValue,
                          Estacion: ctx.byId("puesto").getValue(),
                          Transporte: sTransporte,
                          CantAsignada: 0,
                          ConfirmadoEnRuta: "",
                        };

                        oModel.create("/zlog_ventiladoSet", oEntryBuscDatos, {
                          success: function (data) {
                          },
                          error: function (err) {
                            console.error(
                              "Error al crear registro BUSC.DATOS:",
                              err
                            );
                          },
                        });

                        sTipoLog = "RELOJ";
                        var aFilters = [
                          new sap.ui.model.Filter(
                            "Transporte",
                            sap.ui.model.FilterOperator.EQ,
                            sTransporte
                          ),
                          new sap.ui.model.Filter(
                            "TipoLog",
                            sap.ui.model.FilterOperator.EQ,
                            sTipoLog
                          ),
                        ];

                        oModel.read("/zlog_ventiladoSet", {
                          filters: aFilters,
                          success: function (oData) {
                            if (oData.results && oData.results.length > 0) {
                              var horaObj = oData.results[0].Reloj;
                              var ms = horaObj && horaObj.ms ? horaObj.ms : 0;
                              // Convert ms to HH:MM:SS
                              var totalSeconds = Math.floor(ms / 1000);
                              var hours = Math.floor(totalSeconds / 3600);
                              var minutes = Math.floor(
                                (totalSeconds % 3600) / 60
                              );
                              var seconds = totalSeconds % 60;
                              var hh = String(hours).padStart(2, "0");
                              var mm = String(minutes).padStart(2, "0");
                              var ss = String(seconds).padStart(2, "0");
                              var formattedTime = hh + ":" + mm + ":" + ss;
                              // Update clock model
                              var oClockModel = ctx
                                .getOwnerComponent()
                                .getModel("clock");
                              oClockModel.setProperty("/time", formattedTime);
                              oClockModel.setProperty(
                                "/elapsedSeconds",
                                totalSeconds
                              );
                              oClockModel.setProperty("/isRunning", true);
                              localStorage.setItem(
                                "clockData",
                                JSON.stringify(oClockModel.getData())
                              );
                              ctx
                                .getOwnerComponent()
                                ._startClockTimer(oClockModel);
                              // Validar y actualizar cronómetro si horainicio > 0
                              ctx._validarYActualizarCronometro();
                            }
                          },
                        });
                      }
                    },
                    error: function (oError) {
                      MessageBox.error(
                        "Error al consultar registros existentes."
                      );
                    },
                  });
                }
              },
              error: function (oError) {
                console.error(
                  "Error al leer datos del servicio OData:",
                  oError
                );
                BusyIndicator.hide(); // Ocultar BusyIndicator en caso de error
              },
            });
          };
        };
      },

      _validarYActualizarCronometro: function () {
        // Obtener horainicio del localStorage
        var sHoraInicioOData = localStorage.getItem("horainicio");

        if (!sHoraInicioOData) {
          return; // No hay valor guardado, no hacer nada
        }

        // Función para convertir formato OData "PTxxHxxMxxS" a segundos
        function fromODataTimeToSeconds(oDataTime) {
          if (!oDataTime) return 0;

          var match = oDataTime.match(/PT(\d+)H(\d+)M(\d+)S/);
          if (!match) return 0;

          var hours = parseInt(match[1], 10);
          var minutes = parseInt(match[2], 10);
          var seconds = parseInt(match[3], 10);

          return hours * 3600 + minutes * 60 + seconds;
        }

        var horaInicioEnSegundos = fromODataTimeToSeconds(sHoraInicioOData);

        if (horaInicioEnSegundos > 0) {
          // Obtener la hora actual
          var now = new Date();
          var horaActualEnSegundos =
            now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

          // Calcular la diferencia: hora actual - hora inicio
          var diferenciaEnSegundos =
            horaActualEnSegundos - horaInicioEnSegundos;

          // Si la diferencia es negativa, significa que cruzamos la medianoche
          if (diferenciaEnSegundos < 0) {
            diferenciaEnSegundos += 24 * 3600; // Agregar 24 horas
          }

          // Convertir a formato HH:MM:SS
          var hours = Math.floor(diferenciaEnSegundos / 3600);
          var minutes = Math.floor((diferenciaEnSegundos % 3600) / 60);
          var seconds = diferenciaEnSegundos % 60;

          var formattedTime =
            String(hours).padStart(2, "0") +
            ":" +
            String(minutes).padStart(2, "0") +
            ":" +
            String(seconds).padStart(2, "0");

          // Actualizar el cronómetro
          var oClockModel = this.getOwnerComponent().getModel("clock");
          oClockModel.setProperty("/time", formattedTime);
          oClockModel.setProperty("/elapsedSeconds", diferenciaEnSegundos);
          oClockModel.setProperty("/isRunning", true);

          // Guardar en localStorage
          localStorage.setItem(
            "clockData",
            JSON.stringify(oClockModel.getData())
          );

          // Reiniciar el timer del cronómetro
          this.getOwnerComponent()._startClockTimer(oClockModel);
        }
      },

      /******   Cuando se sale de la pagina se cierran todas las conexiones a la base local */
      onExit: function () {
        this.closeAllDbConnections(); // Cerrar todas las conexiones cuando se cierre el controlador
      },

      closeAllDbConnections: function () {
        this._dbConnections.forEach((db) => {
          db.close();
        });
        this._dbConnections = []; // Resetear el array de conexiones
      },
      _handleUnload: function () {
        this.closeAllDbConnections();
      },

      onConfigurarDisplaysDanados: function () {
        var oView = this.getView();
        ctx = this;
        // Check if the fragment is already loaded
        if (!this.byId("checkboxDialog")) {
          Fragment.load({
            id: oView.getId(),
            name: "ventilado.ventiladoptl.view.CheckBoxDialog",
            controller: this,
          }).then(function (oDialog) {
            oView.addDependent(oDialog);
            const aItems = [];
            for (let i = 1; i <= 30; i++) {
              aItems.push({
                text: "dsp-" + i.toString().padStart(3, "0"),
                selected: false, // 👈 aseguramos que el valor inicial es false
              });
            }

            const oModel = new sap.ui.model.json.JSONModel({
              leftColumn: aItems.slice(0, 15),
              rightColumn: aItems.slice(15),
            });
            oView.setModel(oModel, "checkboxes");
            // this.getView.Entrega
            oDialog.open();
            ctx._preseleccionarDisplaysMarcados(oDialog);
          });
        } else {
          const aItems = [];
          for (let i = 1; i <= 30; i++) {
            aItems.push({
              text: "dsp-" + i.toString().padStart(3, "0"),
              selected: false, // 👈 aseguramos que el valor inicial es false
            });
          }

          const oModel = new sap.ui.model.json.JSONModel({
            leftColumn: aItems.slice(0, 15),
            rightColumn: aItems.slice(15),
          });
          oView.setModel(oModel, "checkboxes");
          // this.getView.Entrega
          this.byId("checkboxDialog").open();
          ctx._preseleccionarDisplaysMarcados(this.byId("checkboxDialog"));
        }
      },

      /**
       * Handler for the close event of the checkbox dialog.
       * Closes the checkbox dialog.
       */
      onCloseDialog: function () {
        this.byId("checkboxDialog").close();
      },
      onAceptarDisplays: function () {
        const oDialog = this.byId("checkboxDialog");
        const oHBox = oDialog.getContent()[0];
        const seleccionados = [];

        oHBox.getItems().forEach((oVBox) => {
          oVBox.getItems().forEach((oHBoxInner) => {
            if (oHBoxInner.isA("sap.m.HBox")) {
              oHBoxInner.getItems().forEach((oControl) => {
                if (oControl.isA("sap.m.CheckBox") && oControl.getSelected()) {
                  seleccionados.push(oControl.getText());
                }
              });
            }
          });
        });

        localStorage.setItem(
          "displaysDesactivados",
          JSON.stringify(seleccionados)
        );
        MessageToast.show("Displays desactivados: " + seleccionados.join(", "));
        oDialog.close();
        this._actualizarIndicadorDisplaysMarcados();
      },
      verificarAsignacionDeDisplays: function () {
        const ctx = this;
        const request = indexedDB.open("ventilado", 5);

        request.onsuccess = function (event) {
          const db = event.target.result;
          const transaction = db.transaction(["ventilado"], "readonly");
          const objectStore = transaction.objectStore("ventilado");

          const rutasConDisplay = new Set();
          const todasLasRutas = new Set();

          const cursorRequest = objectStore.openCursor();

          cursorRequest.onsuccess = function (e) {
            const cursor = e.target.result;
            if (cursor) {
              const registro = cursor.value;

              // Ruta única
              const ruta = registro.LugarPDisp;
              todasLasRutas.add(ruta);

              if (registro.Prodr && registro.Prodr.trim() !== "") {
                rutasConDisplay.add(ruta);
              }

              cursor.continue();
            } else {
              // Al terminar de recorrer
              const todasAsignadas = [...todasLasRutas].every((ruta) =>
                rutasConDisplay.has(ruta)
              );

              if (todasAsignadas) {
                ctx._setBotones(true); // Habilitar todos
              } else {
                ctx._setBotones(false); // Solo avance por ruta
              }
            }
          };
        };
      },
      _setBotones: function (todoHabilitado) {
        const oView = this.getView();

        //oView.byId("btScan").setEnabled(true);
        oView.byId("btLog").setEnabled(true);
        oView.byId("btAvance").setEnabled(true);
        // oView.byId("btDesconsolidado").setEnabled(true);
        oView.byId("btCierre").setEnabled(true);

        // Avance por Ruta siempre habilitado
        oView.byId("btAvanceRuta").setEnabled(true);
      },

      onToggleRollContainer: function (oEvent) {
        const bSelected = oEvent.getParameter("selected");
        const oView = this.getView();
        const oInputLim1 = oView.byId("limite1");
        const oInputLim2 = oView.byId("limite2");

        if (!this._lastLimite2Value) {
          this._lastLimite2Value = oInputLim2.getValue();
        }

        if (!bSelected) {
          // Desactiva Roll Container
          const valLim1 = oInputLim1.getValue();
          oInputLim2.setValue(valLim1);
          oInputLim2.setEnabled(false);
          localStorage.setItem("usarRoll", "false");
        } else {
          // Activa Roll Container
          oInputLim2.setEnabled(true);
          oInputLim2.setValue(this._lastLimite2Value || "12");
          localStorage.setItem("usarRoll", "true");
        }
      },
      _actualizarIndicadorDisplaysMarcados: function () {
        const lista = JSON.parse(
          localStorage.getItem("displaysDesactivados") || "[]"
        );
        const hayMarcados = lista.length > 0;
        this.byId("lblDisplaysMarcados").setVisible(hayMarcados);
      },
      /*  _preseleccionarDisplaysMarcados: function (oDialog) {
             // Recuperar selección previa
             const seleccionados = JSON.parse(localStorage.getItem("displaysDesactivados") || "[]");
 
             // El contenido principal es un HBox
             const oHBox = oDialog.getContent()[0];
             if (!oHBox) return;
 
             // Recorremos ambos VBox
             oHBox.getItems().forEach(oVBox => {
                 oVBox.getItems().forEach(oControl => {
                     if (oControl.isA("sap.m.CheckBox")) {
                         const sTexto = oControl.getText();
                         oControl.setSelected(seleccionados.includes(sTexto));
                     }
                 });
             });
         }, */

      _preseleccionarDisplaysMarcados: function (oDialog) {
        // Recuperar selección previa
        const seleccionados = JSON.parse(
          localStorage.getItem("displaysDesactivados") || "[]"
        );

        // El contenido principal es un HBox
        const oHBox = oDialog.getContent()[0];
        if (!oHBox) return;

        // Recorremos ambos VBox (columnas)
        oHBox.getItems().forEach((oVBox) => {
          // Dentro de cada VBox hay varios HBox (CheckBox + Icon)
          oVBox.getItems().forEach((oHBoxItem) => {
            if (oHBoxItem.isA("sap.m.HBox")) {
              oHBoxItem.getItems().forEach((oControl) => {
                if (oControl.isA("sap.m.CheckBox")) {
                  const sTexto = oControl.getText();
                  oControl.setSelected(seleccionados.includes(sTexto));
                }
              });
            }
          });
        });
      },
      _verificarAsignacionYRedirigir: function () {
        const ctx = this;
        const request = indexedDB.open("ventilado", 5);

        request.onsuccess = function (event) {
          const db = event.target.result;
          const transaction = db.transaction(["ventilado"], "readonly");
          const objectStore = transaction.objectStore("ventilado");

          const rutasConDisplay = new Set();
          const todasLasRutas = new Set();

          const cursorRequest = objectStore.openCursor();

          cursorRequest.onsuccess = function (e) {
            const cursor = e.target.result;
            if (cursor) {
              const registro = cursor.value;
              const ruta = registro.LugarPDisp;
              todasLasRutas.add(ruta);

              if (registro.Prodr && registro.Prodr.trim() !== "") {
                rutasConDisplay.add(ruta);
              }

              cursor.continue();
            } else {
              const todasAsignadas = [...todasLasRutas].every((ruta) =>
                rutasConDisplay.has(ruta)
              );

              if (todasAsignadas) {
                ctx._setBotones(true);
              } else {
                ctx._setBotones(false);

                // Redirigir automáticamente a Avance por
                ctx.onExit();
                const oRouter = sap.ui.core.UIComponent.getRouterFor(ctx);
                localStorage.setItem("origen", "");
                oRouter.navTo("Avance2");
              }
            }
          };
        };
      },
      /*********************** */
      /* -------------------------------------------------------- */
      /* 1) Leer ZPICK_ESTSet y construir la lista SIN duplicados */
      /* -------------------------------------------------------- */
      _cargarDepositos: function () {
        var oOData = new ODataModel("/sap/opu/odata/sap/ZVENTILADO_SRV/");
        // const oOData = this.getOwnerComponent().getModel(); // modelo por defecto
        BusyIndicator.show(0);

        // Pedimos sólo las columnas necesarias para aligerar la carga
        oOData.read("/ZPICK_ESTSet", {
          success: (oData) => {
            BusyIndicator.hide();

            // --- deduplicar por Deposito ------------------------------------
            const aUniq = [];
            const oVisto = {}; // hash para no repetir
            oData.results.forEach((r) => {
              if (r.Deposito && !oVisto[r.Deposito]) {
                oVisto[r.Deposito] = true;
                aUniq.push({
                  Codigo: r.Deposito,
                  Descripcion: r.Descripcion || r.Deposito,
                });
              }
            });
            // Cargar modelo "deps" para el Select
            const oJson = new JSONModel(aUniq);
            this.getView().setModel(oJson, "deps");
          },
          error: () => {
            BusyIndicator.hide();
            MessageBox.error("No se pudo leer la lista de depositos");
          },
        });
      },

      /* -------------------------------------------------------- */
      /*  Si ya estaba asignada (segunda vez que abre la app)     */
      /* -------------------------------------------------------- */
      _rellenarDatosFijos: function () {
        this.byId("selDeposito").setSelectedKey(
          localStorage.getItem("depositoCod")
        );

        this.byId("selDeposito").setEnabled(false);
        this.byId("puesto").setValue(localStorage.getItem("estacionTxt"));
        // this.getView().getModel().setProperty("/estacionAsignada", true);
        this.byId("puesto").setEnabled(false);
        this.byId("btnAsignar").setEnabled(false);
      },
      onAsignarPress: function () {
        var sDeposito = this.byId("selDeposito").getSelectedKey(); // para que se actualice el modelo
        // this._asignarEstacion(sDeposito);   // reutilizas la misma función
        // if (!sDeposito) { return; }

        var oOData = new sap.ui.model.odata.v2.ODataModel(
          "/sap/opu/odata/sap/ZVENTILADO_SRV/",
          {
            useBatch: false,
            defaultBindingMode: "TwoWay",
            deferredGroups: ["batchGroup1"],
          }
        );
        BusyIndicator.show(0);
        var aFilters = [];
        //aFilters.push(new Filter("Asignada", FilterOperator.EQ, ""));
        // Crear el primer filtro: Asignada eq ''
        var oFilterAsignada = new sap.ui.model.Filter(
          "Asignada",
          sap.ui.model.FilterOperator.EQ,
          ""
        );
        // Crear el segundo filtro: Deposito eq '${sDeposito}'
        var oFilterDeposito = new sap.ui.model.Filter(
          "Deposito",
          sap.ui.model.FilterOperator.EQ,
          sDeposito
        );
        // Combinar ambos filtros con el operador AND
        var oCombinedFilter = new sap.ui.model.Filter({
          filters: [oFilterAsignada, oFilterDeposito],
          and: true, // Esto indica que los filtros deben cumplirse simultáneamente (AND)
        });

        // Agregar el filtro combinado al array de filtros
        aFilters.push(oCombinedFilter);
        const sPath = "/ZPICK_ESTSet";
        oOData.read(sPath, {
          filters: aFilters,
          success: (oData) => {
            BusyIndicator.hide();
            if (!oData.results.length) {
              MessageBox.error("No hay estaciones libres para este deposito");
              return;
            }
            const oRow = oData.results[0];

            // --- 3) Marcarla como ocupada ----------------------------
            const sKeyPath = oOData.createKey("ZPICK_ESTSet", { Id: oRow.Id });
            oOData.update(
              "/" + sKeyPath,
              { Asignada: "X" },
              {
                merge: true,
                success: () => {
                  // Persistir en localStorage
                  localStorage.setItem("depositoCod", sDeposito);
                  localStorage.setItem("estacionId", oRow.Id);
                  localStorage.setItem("estacionTxt", oRow.Estacion || oRow.Id);
                  localStorage.setItem("IpApi", oRow.IpApi);

                  // Rellenar y bloquear controles
                  this.byId("selDeposito").setEnabled(false);
                  this.byId("puesto").setValue(oRow.Estacion);
                  this.byId("puesto").setEnabled(false);
                  this.byId("btnAsignar").setEnabled(false);
                  this.getView()
                    .getModel()
                    .setProperty("/estacionAsignada", true);

                  MessageToast.show("Estación asignada: " + oRow.Estacion);
                },
                error: () => MessageBox.error("Error al reservar la estacion"),
              }
            );
          },
          error: () => {
            BusyIndicator.hide();
            MessageBox.error("Error al buscar la estacion libre");
          },
        });
      },
      onAdminUnlock: function () {
        const oView = this.getView();
        const input = new sap.m.Input({
          type: "Password",
          placeholder: "Ingrese clave",
        });

        const dialog = new sap.m.Dialog({
          title: "Desbloquear asignación",
          content: [input],
          beginButton: new sap.m.Button({
            text: "Aceptar",
            press: () => {
              const clave = input.getValue();
              if (clave === "12345") {
                // 🔐 Cambiar a tu clave real

                /****  marcar como libre  */
                var oOData = new sap.ui.model.odata.v2.ODataModel(
                  "/sap/opu/odata/sap/ZVENTILADO_SRV/",
                  {
                    useBatch: false,
                    defaultBindingMode: "TwoWay",
                    deferredGroups: ["batchGroup1"],
                  }
                );
                // Intentar obtener primero de localStorage
                let sEstacionId = localStorage.getItem("estacionId");

                // Si es nulo o vacío, tomarlo desde el Input de la view
                if (!sEstacionId) {
                  sEstacionId = this.byId("puesto").getValue();
                }

                // Generar la clave con el valor final
                const sKeyPath = oOData.createKey("ZPICK_ESTSet", {
                  Id: sEstacionId,
                });

                //const sKeyPath = oOData.createKey("ZPICK_ESTSet", { Id: localStorage.getItem("estacionId") });
                oOData.update(
                  "/" + sKeyPath,
                  { Asignada: "" },
                  {
                    merge: true,
                    success: () => {
                      localStorage.removeItem("depositoCod");
                      localStorage.removeItem("estacionId");
                      localStorage.removeItem("estacionTxt");
                      localStorage.removeItem("IpApi");
                      oView.byId("puesto").setValue("");
                      oView.byId("selDeposito").setEnabled(true);
                      oView.byId("puesto").setEnabled(true);
                      oView.byId("btnAsignar").setEnabled(true);
                      MessageToast.show("Estacion asignada: " + oRow.Estacion);
                    },
                    error: () =>
                      MessageBox.error("Error al reservar la estacion"),
                  }
                );

                sap.m.MessageToast.show("Modo administrador activado");
                dialog.close();
              } else {
                sap.m.MessageBox.error("Clave incorrecta");
              }
            },
          }),
          endButton: new sap.m.Button({
            text: "Cancelar",
            press: () => dialog.close(),
          }),
          afterClose: () => dialog.destroy(),
        });

        dialog.open();
      },
      onTestDisplays: function () {
        const sPuesto = this.byId("puesto").getValue();
        fetch(
          `${PTL_API_URL}/test?workstationId=${encodeURIComponent(sPuesto)}`,
          {
            method: "POST",
          }
        )
          .then((response) => response.json())
          .then((data) => {
            MessageToast.show("Display Encendidos.");
          })
          .catch((err) => {
            console.error("Error al probar displays:", err);
          });
      },

      onApagarDisplays: function () {
        const sPuesto = this.byId("puesto").getValue();
        fetch(
          `${PTL_API_URL}/apagar?workstationId=${encodeURIComponent(sPuesto)}`,
          {
            method: "POST",
          }
        )
          .then((response) => response.json())
          .then((data) => {
            MessageToast.show("Display Apagados.");
          })
          .catch((err) => {
            console.error("Error al apagar displays:", err);
          });
      },

      todosEstadoInicial: async function () {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open("ventilado", 5);

          request.onsuccess = function (event) {
            const db = event.target.result;
            const transaction = db.transaction(["ventilado"], "readonly");
            const objectStore = transaction.objectStore("ventilado");

            const cursorRequest = objectStore.openCursor();
            let allInicial = true; // asumimos que todos son "INICIAL" hasta encontrar lo contrario

            cursorRequest.onsuccess = function (event) {
              const cursor = event.target.result;
              if (cursor) {
                const data = cursor.value;
                if (data.Estado !== "INICIAL") {
                  allInicial = false;
                  // ya podemos cortar el cursor
                  resolve(false);
                  return;
                }
                cursor.continue();
              } else {
                // Terminamos de recorrer sin encontrar distinto a "INICIAL"
                resolve(allInicial);
              }
            };

            cursorRequest.onerror = function (event) {
              reject("Error al leer registros: " + event.target.error);
            };
          };

          request.onerror = function (event) {
            reject("Error al abrir la base de datos: " + event.target.error);
          };
        });
      },
      onAdminUnlockLog: function () {
        const oView = this.getView();
        const input = new sap.m.Input({
          type: "Password",
          placeholder: "Ingrese clave",
        });

        const dialog = new sap.m.Dialog({
          title: "Acceso al log de transportes",
          content: [input],
          beginButton: new sap.m.Button({
            text: "Aceptar",
            press: () => {
              const clave = input.getValue();
              if (clave === "12345") {
                sap.m.MessageToast.show("Modo administrador activado");
                dialog.close();
                var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                oRouter.navTo("Logtransporte");
              } else {
                sap.m.MessageBox.error("Clave incorrecta");
              }
            },
          }),
          endButton: new sap.m.Button({
            text: "Cancelar",
            press: () => dialog.close(),
          }),
          afterClose: () => dialog.destroy(),
        });

        dialog.open();
      },
    });
  }
);
