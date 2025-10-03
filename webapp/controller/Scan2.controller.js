sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/PDFViewer",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/odata/v2/ODataModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/Button",
  ],
  function (
    Controller,
    MessageToast,
    PDFViewer,
    Fragment,
    JSONModel,
    ODataModel,
    Filter,
    FilterOperator,
    MessageBox,
    Dialog,
    Label,
    Input,
    Button
  ) {
    "use strict";
    var ctx = this; // Variable global en el controlador para guardar el contexto
    var ctx2 = this;
    var sTransporte;
    var sPuesto;
    var sReparto;
    var sPtoPlanif;
    var sUsuario;
    var completo;
    var PTL_API_URL = localStorage.getItem("IpApi"); //"https://10.211.112.125:3000";//"https://192.168.193.72:3001/api";
    var datosD = [];
    //   var sFecha;
    var maxAdicChar2 = 0;
    return Controller.extend("ventilado.ventiladoptl.controller.Scan2", {
      onInit: function () {
        ctx = this;

        this._dbConnections = []; // Array para almacenar conexiones abiertas
        // Obtener el router y attachRouteMatched
        var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter.getRoute("Scan").attachMatched(this.onRouteMatched, this);

        var oModel = new sap.ui.model.json.JSONModel();
        this.getView().setModel(oModel);
        // Manejar eventos de navegación
        window.addEventListener("beforeunload", this._handleUnload.bind(this));
        window.addEventListener("popstate", this._handleUnload.bind(this));
        // Ejecutar acciones iniciales
        this.ejecutarAcciones();
        this.getView().addEventDelegate(
          {
            onAfterRendering: () => {
              const oModel = this.getView().getModel();
              if (oModel.getProperty("/isStarted")) {
                const oInput = this.byId("eanInput");
                if (oInput) {
                  oInput.focus();
                }
              }
            },
          },
          this
        );
      },

      onRouteMatched: function () {
        this._dbConnections = []; // Array para almacenar conexiones abiertas
        //inicializa datos
        var oModel = this.getView().getModel();
        var cantidad = this.getView().byId("txtCantidad");
        var sRuta = this.getView().byId("txtRuta");
        var descripcion = this.getView().byId("lDescripcion");
        var Ean = this.getView().byId("eanInput");
        var ci = this.getView().byId("edtCI");

        oModel.setProperty("/ruta", 0);
        oModel.setProperty("/cantidad", 0);
        oModel.setProperty("/cantidadAEscanear", 0);
        oModel.setProperty("/ean", "");
        oModel.setProperty("/id", 0);
        oModel.setProperty("/isArrowVisible", false);
        oModel.setProperty("/ultimoProdScan", ci.getText());
        oModel.setProperty("/descUltimoProdScan", descripcion.getText());

        cantidad.setText("");
        sRuta.setText("");
        descripcion.setText("");
        Ean.setValue("");
        ci.setText("");
        // Ejecutar acciones cada vez que la ruta es navegada
        this.ejecutarAcciones();
        this.getView().addEventDelegate(
          {
            onAfterRendering: () => {
              const oModel = this.getView().getModel();
              if (oModel.getProperty("/isStarted")) {
                const oInput = this.byId("eanInput");
                if (oInput) {
                  oInput.focus();
                }
              }
            },
          },
          this
        );
      },
      seRealizoDesafect: async function () {
        var oModel = new ODataModel("/sap/opu/odata/sap/ZVENTILADO_SRV/");
        var aFilters = [];
        aFilters.push(
          new Filter(
            "Transporte",
            FilterOperator.EQ,
            localStorage.getItem("sReparto")
          )
        );
        ctx = this;

        // Crear una Promesa para manejar la respuesta asíncrona
        return new Promise((resolve, reject) => {
          oModel.read("/zdesafectacionSet", {
            filters: aFilters,
            success: function (oData) {
              if (oData.results && oData.results.length > 0) {
                // Si hay registros, devuelve true
                resolve(true);
              } else {
                // Si no hay registros, devuelve false
                resolve(false);
              }
            },
            error: function (oError) {
              console.error("Error al leer datos del servicio OData:", oError);
              reject(false); // Si hay un error, también podemos devolver false
            },
          });
        });
      },

      ejecutarAcciones: async function () {
        let datos = await this.obtenerDatosDeIndexedDB();
        datosD = datos; // Guardar los datos en una variable global para su uso posterior
        //veo si esta completo el escaneo
        // Sumar el total de CantEscaneada y CantidadEntrega
        const { totalEscaneada, totalEntrega } = datos.reduce(
          (totales, item) => {
            totales.totalEscaneada += item.CantEscaneada || 0;
            totales.totalEntrega += item.CantidadEntrega || 0;
            return totales;
          },
          { totalEscaneada: 0, totalEntrega: 0 }
        );
        // Calcular la diferencia entre ambos totales
        completo = totalEntrega - totalEscaneada;
        if (completo == 0) {
          this.getView().byId("eanInput").setVisible(false);
          this.getView().byId("parcialButton").setEnabled(false);
        }

        maxAdicChar2 = await this.obtenerMaxAdicChar2();
        // Leer datos locales
        sPuesto = localStorage.getItem("sPuesto");
        sReparto = localStorage.getItem("sReparto");
        sPtoPlanif = localStorage.getItem("sPtoPlanif");
        sUsuario = localStorage.getItem("sPreparador");
        PTL_API_URL = localStorage.getItem("IpApi"); //"https://192.168.193.72:3001/api";//
        //completo con ceros
        //  sReparto = sReparto.padStart(10, '0');
        sPtoPlanif = sPtoPlanif.padStart(4, "0");

        this._checkNetworkStatus(); // funcion para que el navegador controle la conexion a internet

        this.elapsedTime = 0;
        this.intervalId = null;
        this.startTime = null;

        var oModel = new sap.ui.model.json.JSONModel({
          elapsedTime: 0,
          formattedElapsedTime: "00:00:00",
          scanState: "Stopped",
          stateClass: "stopped", // Add initial state class
          tableData: [],
        });

        var codConfirmacionData = await this._fetchCodConfirmacionData(); // Llamar a la función para leer los Codigos de confirmacion de ruta del backend
        oModel.setProperty("/codConfirmacionData", codConfirmacionData);
        oModel.setProperty(
          "/ultimoProdScan",
          localStorage.getItem("ultimoProdScan")
        );
        oModel.setProperty(
          "/descUltimoProdScan",
          localStorage.getItem("descUltimoProdScan")
        );

        this.getView().setModel(oModel);

        // Load saved state
        var savedState = localStorage.getItem("scanState");
        var savedTime = localStorage.getItem("elapsedTime");

        if (savedState && savedTime) {
          oModel.setProperty("/scanState", savedState);
          oModel.setProperty("/stateClass", this._getStateClass(savedState)); // Update class based on saved state
          this.elapsedTime = parseInt(savedTime, 10);
          this._updateFormattedTime();
        }

        // Set interval to update the timer display every second
        this._intervalId = setInterval(
          this._updateFormattedTime.bind(this),
          1000
        );
        await this.obtenerYProcesarDatos();
        await this.obtenerYProcesarDatos2();
      },

      /****** Inicio: Obtiene los datos de la Base local agrupa x Ruta y arma  la tabla de avance  */
      obtenerMaxAdicChar2: async function () {
        let datos = await this.obtenerDatosDeIndexedDB();
        let maxAdicChar2 = 0;
        datos.forEach((item) => {
          let valorAdicChar2 = parseInt(item.AdicChar2, 10);
          if (!isNaN(valorAdicChar2) && valorAdicChar2 > maxAdicChar2) {
            maxAdicChar2 = valorAdicChar2;
          }
        });
        return maxAdicChar2;
      },
      obtenerYProcesarDatos: async function () {
        try {
          var oModel = this.getView().getModel(); // Obtener el modelo de la vista
          var sStarted;
          //  oModel.setProperty("/desafectacion", false)
          if (oModel.getProperty("/isStarted")) {
            oModel.setProperty("/isStarted", true);
            sStarted = true;
          } else {
            oModel.setProperty("/isStarted", false);
            sStarted = false;
          }

          let datos = await this.obtenerDatosDeIndexedDB();
          //veo si esta completo el escaneo

          let resultado = this.procesarDatos(datos);
          //Calculo los totales para la tabla avance
          var total = resultado.reduce(function (accumulator, currentValue) {
            return accumulator + Number(currentValue.TOT);
          }, 0);
          var totalScan = resultado.reduce(function (
            accumulator,
            currentValue
          ) {
            return accumulator + Number(currentValue.SCAN);
          },
          0);
          var totalFalta = resultado.reduce(function (
            accumulator,
            currentValue
          ) {
            return accumulator + Number(currentValue.FALTA);
          },
          0);
          var totalCubTeo = resultado.reduce(function (
            accumulator,
            currentValue
          ) {
            return accumulator + Number(currentValue["Cub TEO"]);
          },
          0);
          //Recupera el estado del transporte

          // Nombres de las columnas
          var columnNames = [
            "Ruta",
            "CLIENTE",
            "RAZONSOCIAL",
            "TOT",
            "SCAN",
            "FALTA",
            "Cub TEO",
            "C Real",
            "Pa",
            ,
            "DISPLAY",
          ];

          // Mapear arrayResultado a la estructura de tableDataArray
          var tableDataArray = resultado.map((registro) => {
            var nuevoRegistro = {};
            columnNames.forEach((column) => {
              nuevoRegistro[column] = registro[column] || "0";
            });
            return nuevoRegistro;
          });
          await this._fetchCodConfirmacionData(); // Llamar a la función para leer los Codigos de confirmacion de ruta del backend
          // Actualizar el modelo con tableDataArray

          var codConfirmacionData = oModel.getProperty("/codConfirmacionData");

          oModel.setData({
            printEtiquetas: false,
            isStarted: sStarted,
            isArrowVisible: false, //oModel.getProperty("/isArrowVisible"),
            isClosed: true, //oModel.getProperty("/isClosed"),
            showPasswordInput: false,
            tableData: tableDataArray,
            tableData3: oModel.getProperty("/tableData3"),
            totalP: total,
            totalScan: totalScan,
            totalFalta: totalFalta,
            totalCubTeo: totalCubTeo,
            estadoDelTransporte: "",
            puesto: "Estacion de trabajo Nro: " + sPuesto,
            transporte: "Reparto: " + String(Number(sReparto)),
            cuenta: oModel.getProperty("/cuenta"),
            cantidad: oModel.getProperty("/cantidad"),
            cantidadAEscanear: oModel.getProperty("/cantidadAEscanear"),
            ruta: oModel.getProperty("/ruta"),
            ean: "",
            eanRuta: "",
            id: oModel.getProperty("/id"),
            ultimoProdScan: oModel.getProperty("/ultimoProdScan"),
            descUltimoProdScan: oModel.getProperty("/descUltimoProdScan"),
            codConfirmacionData: codConfirmacionData,
            Kgbrv: "",
            M3v: "",
            cubTeorica: 0,

            scanState: oModel.getProperty("/scanState"),
            stateClass: oModel.setProperty("/stateClass"),
          });
          this.getView().setModel(oModel);

          console.log(tableDataArray);
        } catch (error) {
          console.log("Error:", error);
        }
      },

      obtenerYProcesarDatos2: async function () {
        try {
          let datos = await this.obtenerDatosDeIndexedDB();
          let resultado = this.procesarDatos2(datos);
          //Calculo los totales para la tabla avance
          var total = 0;
          var totalScan = 0;
          var totalFalta = 0;
          var totalCubTeo = 0;
          //Recupera el estado del transporte

          // Nombres de las columnas
          var columnNames = [
            "Ruta",
            "CLIENTE",
            "RAZONSOCIAL",
            "TOT",
            "SCAN",
            "FALTA",
            "Cub TEO",
            "C Real",
            "Pa",
            ,
            "DISPLAY",
          ];

          // Mapear arrayResultado a la estructura de tableDataArray
          var tableDataArray = resultado.map((registro) => {
            var nuevoRegistro = {};
            columnNames.forEach((column) => {
              nuevoRegistro[column] = registro[column] || "0";
            });
            return nuevoRegistro;
          });

          // Actualizar el modelo con tableDataArray
          var oModel = this.getView().getModel(); // Obtener el modelo de la vista
          var codConfirmacionData = oModel.getProperty("/codConfirmacionData");
          var sStarted;

          if (oModel.getProperty("/isStarted")) {
            sStarted = true;
          } else {
            sStarted = false;
          }

          oModel.setData({
            printEtiquetas: false,
            isStarted: false, //sStarted,
            isArrowVisible: false, //oModel.getProperty("/isArrowVisible"),
            isClosed: true, //oModel.getProperty("/isClosed"),
            showPasswordInput: false,
            tableData: oModel.getProperty("/tableData"),
            tableData3: tableDataArray,
            totalP: total,
            totalScan: totalScan,
            totalFalta: totalFalta,
            totalCubTeo: totalCubTeo,
            estadoDelTransporte: "",
            puesto: "Estacion de trabajo Nro: " + sPuesto,
            transporte: "Reparto: " + String(Number(sReparto)),
            cuenta: 0,
            cantidad: 0,
            cantidadAEscanear: 0,
            ruta: 0,
            ean: "",
            eanRuta: "",
            id: 0,
            ultimoProdScan: oModel.getProperty("/ultimoProdScan"),
            descUltimoProdScan: oModel.getProperty("/descUltimoProdScan"),
            codConfirmacionData: codConfirmacionData,
            Kgbrv: "",
            M3v: "",
            cubTeorica: 0,
            realCubetasTotal: 0,
            realPalletsTotal: 0,
          });
          // Calcular los totales iniciales
          oModel.setProperty(
            "/realCubetasTotal",
            "Total : " +
              tableDataArray.reduce(
                (sum, item) => sum + (parseFloat(item["C Real"]) || 0),
                0
              )
          );
          oModel.setProperty(
            "/realPalletsTotal",
            "Total : " +
              tableDataArray.reduce(
                (sum, item) => sum + (parseFloat(item["Pa"]) || 0),
                0
              )
          );
          oModel.setProperty(
            "/realRollsTotal",
            "Total : " +
              tableDataArray.reduce(
                (sum, item) => sum + (parseFloat(item["Ro"]) || 0),
                0
              )
          );
          this.getView().setModel(oModel);

          console.log(tableDataArray);
        } catch (error) {
          console.log("Error:", error);
        }
      },

      obtenerDatosDeIndexedDB: function () {
        var ctx = this;
        return new Promise((resolve, reject) => {
          let request = indexedDB.open("ventilado", 5);

          request.onerror = (event) => {
            console.log("Error al abrir la base de datos:", event);
            reject("Error al abrir la base de datos");
          };

          request.onsuccess = (event) => {
            let db = event.target.result;
            ctx._dbConnections.push(db); // Guardar referencia a la conexión abierta
            let transaction = db.transaction(["ventilado"], "readonly");
            let objectStore = transaction.objectStore("ventilado");
            let data = [];

            objectStore.openCursor().onsuccess = (event) => {
              let cursor = event.target.result;
              if (cursor) {
                data.push(cursor.value);
                cursor.continue();
              } else {
                resolve(data);
              }
            };
          };
        });
      },

      procesarDatos: function (datos) {
        ctx = this;
        let resultado = {};
        var ci = this.getView().byId("edtCI");
        datos.forEach((registro) => {
          var oModel = ctx.getView().getModel();

          var cod;
          if (ci.getText() == "" && oModel.getProperty("/isStarted")) {
            cod = ci.getText();
          } else if (ci.getText() == "" && !oModel.getProperty("/isStarted")) {
            cod = localStorage.getItem("ultimoProdScan");
          } else if (ci.getText() != "" && oModel.getProperty("/isStarted")) {
            cod = ci.getText();
          }
          var tipo = ctx.getView().byId("edtTipo").getText();
          //if (registro.CodigoInterno  === ci.getText()) {
          if (registro.CodigoInterno === cod && tipo == registro.M3teo) {
            let ruta = registro.LugarPDisp;
            let cantidad = registro.CantidadEntrega;
            let sCantEscaneada = registro.CantEscaneada;
            if (!resultado[ruta]) {
              // Inicializa el objeto de la ruta si no existe
              resultado[ruta] = {
                Ruta: ruta,
                TOT: 0,
                SCAN: 0,
                FALTA: 0,
                "Cub TEO": registro.Cubteo,
                "C Real": 0,
                Pa: 0,
                TRANSPORTE: registro.Transporte,
                ENTREGA: registro.Entrega,
                CUBETA: 0,
                //   "TOTALCUBETA" : 0,  "Cub TEO"
                PRODUCTO: 0,
                KILO: 0,
                M3: registro.M3teo,
                CLIENTE: registro.Destinatario,
                RAZONSOCIAL: registro.NombreDestinatario,
                DIRECCION: registro.Calle,
                LOCALIDAD: registro.LugarDestinatario,
                CODIGOINTERNO: registro.CodigoInterno,
                // "DISPLAY": registro.display
                DISPLAY:
                  registro.Prodr || registro.display
                    ? (registro.Prodr || registro.display).startsWith("dsp-")
                      ? registro.Prodr || registro.display
                      : "dsp-" + (registro.Prodr || registro.display)
                    : "",
              };
            }

            // Suma la cantidad al total
            resultado[ruta]["TOT"] += cantidad;
            resultado[ruta]["SCAN"] = Number(sCantEscaneada);
            resultado[ruta]["FALTA"] =
              resultado[ruta]["TOT"] - resultado[ruta]["SCAN"];
            resultado[ruta]["CUBETA"] = "";
            resultado[ruta]["TOTALCUBETA"] = resultado[ruta]["TOTALCUBETA"];
            resultado[ruta]["PRODUCTO"] = resultado[ruta]["TOT"];
            resultado[ruta]["KILO"] += registro.kgbrr;
            resultado[ruta]["M3"] = registro.M3r;
            resultado[ruta]["CLIENTE"] = registro.Destinatario;
            resultado[ruta]["RAZONSOCIAL"] = registro.NombreDestinatario;
            resultado[ruta]["DIRECCION"] = registro.Calle;
            resultado[ruta]["LOCALIDAD"] = registro.LugarDestinatario;
            resultado[ruta]["C Real"] = registro.Cubre;
            resultado[ruta]["Pa"] = registro.Pa;
            resultado[ruta]["Cub TEO"] += Math.ceil(registro.M3v / 0.077); //0,077  volumen de la cubeta
          }
        });

        // Convierte el objeto resultado en un array

        let arrayResultado = Object.keys(resultado).map(
          (ruta) => resultado[ruta]
        );
        // Ordenar por nombre de display (numéricamente)
        arrayResultado.sort((a, b) => {
          const numA = a.DISPLAY
            ? parseInt(a.DISPLAY.replace("dsp-", ""))
            : 9999;
          const numB = b.DISPLAY
            ? parseInt(b.DISPLAY.replace("dsp-", ""))
            : 9999;
          return numA - numB;
        });
        return arrayResultado;
      },

      procesarDatos2: function (datos) {
        let resultado = {};
        var ci = this.getView().byId("edtCI");
        datos.forEach((registro) => {
          let ruta = registro.LugarPDisp;
          let cantidad = registro.CantidadEntrega;
          let sCantEscaneada = registro.CantEscaneada;
          if (!resultado[ruta]) {
            // Inicializa el objeto de la ruta si no existe
            resultado[ruta] = {
              Ruta: ruta,
              TOT: 0,
              SCAN: 0,
              FALTA: 0,
              "Cub TEO": registro.Cubteo,
              "C Real": 0,
              Pa: 0,
              TRANSPORTE: registro.Transporte,
              ENTREGA: registro.Entrega,
              CUBETA: 0,
              //   "TOTALCUBETA" : 0,  "Cub TEO"
              PRODUCTO: 0,
              KILO: 0,
              M3: registro.M3teo,
              CLIENTE: registro.Destinatario,
              RAZONSOCIAL: registro.NombreDestinatario,
              DIRECCION: registro.Calle,
              LOCALIDAD: registro.LugarDestinatario,
              CODIGOINTERNO: registro.CodigoInterno,
              DISPLAY:
                registro.Prodr || registro.display
                  ? (registro.Prodr || registro.display).startsWith("dsp-")
                    ? registro.Prodr || registro.display
                    : "dsp-" + (registro.Prodr || registro.display)
                  : "",
            };
          }

          // Suma la cantidad al total
          resultado[ruta]["TOT"] += cantidad;
          resultado[ruta]["SCAN"] = Number(sCantEscaneada);
          resultado[ruta]["FALTA"] =
            resultado[ruta]["TOT"] - resultado[ruta]["SCAN"];
          // resultado[ruta]["TRANSPORTE"] = registro.Transporte ;
          // resultado[ruta]["ENTREGA"] = registro.Entrega;
          resultado[ruta]["CUBETA"] = "";
          resultado[ruta]["TOTALCUBETA"] = resultado[ruta]["TOTALCUBETA"];
          resultado[ruta]["PRODUCTO"] = resultado[ruta]["TOT"];
          resultado[ruta]["KILO"] += registro.kgbrr;
          resultado[ruta]["M3"] = registro.M3r;
          resultado[ruta]["CLIENTE"] = registro.Destinatario;
          resultado[ruta]["RAZONSOCIAL"] = registro.NombreDestinatario;
          resultado[ruta]["DIRECCION"] = registro.Calle;
          resultado[ruta]["LOCALIDAD"] = registro.LugarDestinatario;
          resultado[ruta]["C Real"] = registro.Cubre;
          resultado[ruta]["Pa"] = registro.Pa;
          resultado[ruta]["Cub TEO"] += Math.ceil(registro.M3v / 0.077); //0,077  volumen de la cubeta

          // Aquí deberías agregar lógica para calcular SCAN, FALTA, Cub TEO, C Real, Pa
        });

        // Convierte el objeto resultado en un array
        let arrayResultado = Object.keys(resultado).map(
          (ruta) => resultado[ruta]
        );
        arrayResultado.sort((a, b) => {
          const numA = a.DISPLAY
            ? parseInt(a.DISPLAY.replace("dsp-", ""))
            : 9999;
          const numB = b.DISPLAY
            ? parseInt(b.DISPLAY.replace("dsp-", ""))
            : 9999;
          return numA - numB;
        });
        return arrayResultado;
      },
      /****** Fin: Obtiene los datos de la Base local agrupa x Ruta y arma  la tabla de avance  */

      _checkNetworkStatus: function () {
        if (navigator.onLine) {
          MessageToast.show("Conexión a internet disponible.");
        } else {
          MessageToast.show("No hay conexión a internet.");
        }
      },

      _updateNetworkStatus: function () {
        this._checkNetworkStatus();
      },

      /******  Borrar la entrada */

      onClearEanInput: function () {
        this.getView()
          .getModel()
          .setProperty("/estadoMensaje", "Esperando escaneo...");
        var oModel = this.getView().getModel();
        var cantidad = this.getView().byId("txtCantidad");
        var sRuta = this.getView().byId("txtRuta");
        var descripcion = this.getView().byId("lDescripcion");
        var Ean = this.getView().byId("eanInput");
        var ci = this.getView().byId("edtCI");

        oModel.setProperty("/ruta", 0);
        oModel.setProperty("/cantidad", 0);
        oModel.setProperty("/cantidadAEscanear", 0);

        oModel.setProperty("/ean", "");
        oModel.setProperty("/id", 0);
        oModel.setProperty("/isArrowVisible", false);
        oModel.setProperty("/ultimoProdScan", ci.getText());
        oModel.setProperty("/descUltimoProdScan", descripcion.getText());
        // Actualiza la pantalla

        cantidad.setText("");
        sRuta.setText("");
        descripcion.setText("");
        Ean.setValue("");
        ci.setText("");
      },
      onParcialPress: function () {
        var ctx2 = this;
        var oDialog = new Dialog({
          title: "Cantidad a Asignar",
          content: [
            new Label({ text: "Ingrese la cantidad a asignar a la ruta" }),
            new Input({
              id: "quantityInput",
              type: "Number",
              placeholder: "Cantidad",
            }),
          ],
          beginButton: new Button({
            text: "OK",
            press: function () {
              var sValue = sap.ui.getCore().byId("quantityInput").getValue();
              if (!isNaN(sValue) && sValue.trim() !== "") {
                sap.ui.getCore().byId("txtCantidad").setText(sValue);
                oDialog.close();
                var Input = ctx2.getView().byId("eanInput");
                setTimeout(function () {
                  Input.focus();
                }, 0);
              } else {
                MessageBox.error("Ingrese un valor numerico valido.");
              }
            },
          }),
          endButton: new Button({
            text: "Cancelar",
            press: function () {
              oDialog.close();
              var Input = ctx2.getView().byId("eanInput");
              setTimeout(function () {
                Input.focus();
              }, 0);
            },
          }),
          afterClose: function () {
            oDialog.destroy();
            var Input = ctx2.getView().byId("eanInput");
            setTimeout(function () {
              Input.focus();
            }, 0);
          },
        });

        oDialog.open();
      },

      /****** Inicio: Arranca proceso de  escaneo  ********************************************/
      onStartPress: function () {
        ctx = this;
        //Reanuda el reloj
        const oClockModel = ctx.getOwnerComponent().getModel("clock");
        oClockModel.setProperty("/isRunning", true);
        localStorage.setItem(
          "clockData",
          JSON.stringify(oClockModel.getData())
        );
        ctx.getOwnerComponent()._startClockTimer(oClockModel);

        var oModel = new sap.ui.model.odata.v2.ODataModel(
          "/sap/opu/odata/sap/ZVENTILADO_SRV/",
          {
            useBatch: false,
            defaultBindingMode: "TwoWay",
          }
        );
        // Primero, buscar si ya existe el registro
        var aFilters = [
          new sap.ui.model.Filter(
            "Transporte",
            sap.ui.model.FilterOperator.EQ,
            sReparto
          ),
        ];
        oModel.read("/ZVENTILADO_KPISet", {
          filters: aFilters,
          success: function (oData) {
            if (oData.results && oData.results.length > 0) {
              // Hay al menos un registro, actualizamos Inicioescaneo
              var registro = oData.results[0];
              var now = new Date();
              var sHoraActual = now.toTimeString().slice(0, 8); // "HH:MM:SS"
              var sODataHoraActual =
                "PT" +
                sHoraActual.split(":")[0] +
                "H" +
                sHoraActual.split(":")[1] +
                "M" +
                sHoraActual.split(":")[2] +
                "S";

              function parseODataDurationToMilliseconds(durationStr) {
                if (typeof durationStr !== "string") return 0;
                const match = durationStr.match(/PT(\d+)H(\d+)M(\d+)S/);
                if (!match) return 0;
                const [, h, m, s] = match.map(Number);
                return ((h * 60 + m) * 60 + s) * 1000;
              }

              function toODataTime(timeStr) {
                var parts = timeStr.split(":");
                return "PT" + parts[0] + "H" + parts[1] + "M" + parts[2] + "S";
              }

              var sODataFechaInicio = "/Date(" + now.getTime() + ")/";
              var sHoraActual = now.toTimeString().slice(0, 8); // "HH:MM:SS"
              var sODataHoraInicio = toODataTime(sHoraActual);

              var cantidadRegistros =
                Number(localStorage.getItem("avanceCantidadRegistros")) || 0;
              var totalKilo = localStorage.getItem("avanceTotalKilo") || "0";
              var totalM3 = localStorage.getItem("avanceTotalM3") || "0";
              totalKilo = Number(totalKilo).toFixed(3);
              totalM3 = Number(totalM3).toFixed(3);
              var totalTot =
                Number(localStorage.getItem("avanceTotalTot")) || 0;
              var oUpdate = [
                {
                  Id: registro.Id,
                  Inicioescaneo: sODataHoraActual,
                  Duracionpreparacion: Math.floor(
                    (parseODataDurationToMilliseconds(sODataHoraActual) -
                      registro.Horainicio.ms) /
                      60000
                  ),
                  Cantidadentrega: cantidadRegistros,
                  Kiloentrega: totalKilo,
                  Volumenentrega: totalM3,
                  Cantidaditem: totalTot,
                },
              ];

              if (registro.Inicioescaneo.ms == "0") {
                ctx.crud(
                  "ACTUALIZAR",
                  "ZVENTILADO_KPI",
                  registro.Id,
                  oUpdate,
                  ""
                );
              }
            }
          },
          error: function (oError) {
            // No mostrar mensajes
          },
        });

        var sTransporte = (function () {
          var fullText = ctx.byId("transporte").getText();
          var code = fullText.replace("Reparto: ", "").trim();
          return code.padStart(10, "0");
        })();
        var sTipoLog = "SCAN";
        var now = new Date();
        var sHoraActual = now.toTimeString().slice(0, 8); // "HH:MM:SS"
        var sODataHoraActual =
          "PT" +
          sHoraActual.split(":")[0] +
          "H" +
          sHoraActual.split(":")[1] +
          "M" +
          sHoraActual.split(":")[2] +
          "S";

        function toODataTime(timeStr) {
          var parts = timeStr.split(":");
          return "PT" + parts[0] + "H" + parts[1] + "M" + parts[2] + "S";
        }

        var sODataFechaInicio = "/Date(" + now.getTime() + ")/";
        var sHoraActual = now.toTimeString().slice(0, 8); // "HH:MM:SS"
        var sODataHoraInicio = toODataTime(sHoraActual);
        var centroValue = localStorage.getItem("depositoCod") || "";
        var preparadorValue = localStorage.getItem("sPreparador") || "";
        var entregaValue = localStorage.getItem("sPtoPlanif") || "";

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
          Entrega: entregaValue,
          Centro: centroValue,
          Preparador: preparadorValue,
          Cliente: "",
          Estacion: (function () {
            var fullText = ctx.byId("puestoScan").getText();
            var code = fullText.replace("Estacion de trabajo Nro: ", "").trim();
            return code;
          })(),
          Transporte: sTransporte,
          CantAsignada: 0,
          ConfirmadoEnRuta: "",
        };

        oModel.create("/zlog_ventiladoSet", oEntry, {
          error: function (err) {
            MessageBox.error("Error al crear el evento.");
          },
        });

        this.getView()
          .getModel()
          .setProperty("/estadoMensaje", "Esperando escaneo...");
        this.getView().byId("estadoMensaje").setVisible(true);
        ctx = this;
        if (completo == 0) {
          ctx.getView().byId("eanInput").setVisible(false);
        }

        ctx.getView().byId("parcialButton").setEnabled(false);
        var oModel = new ODataModel("/sap/opu/odata/sap/ZVENTILADO_SRV/");
        var aFilters = [];
        aFilters.push(
          new Filter(
            "Transporte",
            FilterOperator.EQ,
            localStorage.getItem("sReparto")
          )
        );
        ctx = this;

        oModel.read("/zdesafectacionSet", {
          filters: aFilters,
          success: function (oData) {
            ctx.startTime = Date.now();
            var oModel = ctx.getView().getModel();
            if (oData.results.length > 0) {
              var Input = ctx.getView().byId("eanInput");
              Input.setVisible(false);
              var Input2 = ctx.getView().byId("borrar");
              Input2.setVisible(false);
              var Input3 = ctx.getView().byId("pausa");
              Input3.setEnabled(false);
              oModel.setProperty("/isStarted", true);
            }
            /* inicia reloj*/
            if (ctx.intervalId) {
              clearInterval(ctx.intervalId);
            }

            oModel.setProperty("/scanState", "Running");
            oModel.setProperty("/stateClass", ctx._getStateClass("Running"));

            ctx.intervalId = setInterval(
              ctx._updateFormattedTime.bind(ctx),
              1000
            );

            var oModel = ctx.getView().getModel();
            oModel.setProperty("/isStarted", true);
            /* var Input = ctx.getView().byId("eanInput");
             setTimeout(function () {
               Input.focus();
             }, 0); */
            // Forzá el re-render inmediato
            sap.ui.getCore().applyChanges();

            var oInput = ctx.getView().byId("eanInput");
            setTimeout(function () {
              if (oInput && oInput.getEnabled()) {
                oInput.focus();
                const dom = oInput.getFocusDomRef();
                if (dom) {
                  try {
                    dom.select();
                  } catch (e) {}
                }
              }
            }, 1);

            // Attach the body click event
            document.body.addEventListener("click", ctx._onBodyClick.bind(ctx));
          },
          error: function (oError) {
            console.error("Error al leer datos del servicio OData:", oError);
            reject(false); // Si hay un error, también podemos devolver false
          },
        });
      },

      _onBodyClick: function (ctx, event) {
        var eanInput = this.getView().byId("eanInput");
        eanInput.focus();
      },

      onParcialPress: function () {
        ctx = this;
        var cantidadText = this.getView().byId("txtCantidad").getText();
        var cantidad = Number(cantidadText); // Convertir el texto a número

        var oDialog = new Dialog({
          title: "Cantidad a Asignar",
          content: [
            new Label({ text: "Ingrese la cantidad a asignar a la ruta" }),
            new Input({
              id: "quantityInput",
              type: "Number",
              placeholder: "Cantidad",
            }),
          ],
          beginButton: new Button({
            text: "OK",
            press: function () {
              var sValue = sap.ui.getCore().byId("quantityInput").getValue();
              if (!isNaN(sValue) && sValue.trim() !== "") {
                var sValueNum = Number(sValue); // Convertir sValue a número

                // Verificar que sValue no sea mayor que cantidad
                if (sValueNum <= cantidad) {
                  ctx.getView().byId("txtCantidad").setText(sValue);
                  //ctx.getView().byId("parcialButton").setEnabled(false);

                  var oModel = ctx.getView().getModel();
                  oModel.setProperty("/cantidad", sValueNum); // Actualiza el modelo con el nuevo valor
                  oDialog.close();
                } else {
                  MessageBox.error(
                    "El valor ingresado no puede ser mayor a " + cantidad + "."
                  );
                }
                //ctx.getView().byId("txtCantidad").setText(sValue);
                //ctx.getView().byId("parcialButton").setEnabled(false);
                // var oModel = ctx.getView().getModel();
                // oModel.setProperty("/cantidad", Number(sValue))// actualiza el modelo con el nuevo valor
                // oDialog.close();
              } else {
                MessageBox.error("Ingrese un valor numérico valido.");
              }
            },
          }),
          endButton: new Button({
            text: "Cancelar",
            press: function () {
              oDialog.close();
            },
          }),
          afterClose: function () {
            oDialog.destroy();
          },
        });

        oDialog.open();
      },

      /**    Se dispara con el ENTER luego del EAN */
      onEanInputSubmit: function (oEvent) {
        // Detectar cuando se presiona Enter en el input del EAN
        var oInput = oEvent.getSource();
        var sValue = oInput.getValue();
        // Ejecutar la función deseada
        this.handleEanEnter(sValue);
      },
      handleEanEnter: async function (sValue) {
        var procesa_confirmacion = 0;
        sValue = sValue.replace(/^0+/, "");
        // Lógica a ejecutar cuando se presiona Enter en el input del EAN
        // var cantidad = this.getView().byId("txtCantidad");
        ctx = this;
        // Lógica a ejecutar cuando se presiona Enter en el input del EAN
        var cantidad = this.getView().byId("txtCantidad");
        var sRuta = this.getView().byId("txtRuta");
        var descripcion = this.getView().byId("lDescripcion");
        var Ean = this.getView().byId("eanInput");
        var ci = this.getView().byId("edtCI");
        var edtTipo = this.getView().byId("edtTipo");
        var oModel = this.getView().getModel();
        var parcialButton = this.getView().byId("parcialButton");
        var cantidadYRuta;
        var cantidadYRuta3;
        if (oModel.getProperty("/ruta") == 0) {
          // Entra un codigo y el modelo esta vacio
          try {
            /** vemos si el EAN es un producto */
            cantidadYRuta = await this.obtenerCantidadYRuta(sValue, 1);
            if (cantidadYRuta.cantidad > 0) {
              console.log("es un producto");
              // Actualiza el modelo
              oModel.setProperty("/ruta", cantidadYRuta.ruta);
              oModel.setProperty("/cantidad", cantidadYRuta.cantidad);
              oModel.setProperty("/cantidadAEscanear", cantidadYRuta.cantidad);
              oModel.setProperty("/ean", sValue);
              oModel.setProperty("/id", cantidadYRuta.id);
              oModel.setProperty("/AdicChar2", cantidadYRuta.AdicChar2);
              oModel.setProperty("/Kgbrv", cantidadYRuta.Kgbrv);
              oModel.setProperty("/M3v", cantidadYRuta.M3v);
              // Actualiza la pantalla
              edtTipo.setText(cantidadYRuta.M3teo);
              cantidad.setText(cantidadYRuta.cantidad);
              sRuta.setText(cantidadYRuta.ruta);
              sRuta.setText(cantidadYRuta.display);
              descripcion.setText(cantidadYRuta.descripcion);
              //  Ean.setValue(cantidadYRuta.ean);
              Ean.setValue("");
              ci.setText(cantidadYRuta.ci);
              parcialButton.setEnabled(true);
              oModel.setProperty("/Kgbrv", cantidadYRuta.Kgbrv);
              oModel.setProperty("/M3v", cantidadYRuta.M3v);

              oModel.setProperty("/ultimoProdScan", cantidadYRuta.ci);
              oModel.setProperty(
                "/descUltimoProdScan",
                cantidadYRuta.descripcion
              );
              localStorage.setItem("ultimoProdScan", cantidadYRuta.ci);
              localStorage.setItem(
                "descUltimoProdScan",
                cantidadYRuta.descripcion
              );

              await this.obtenerYProcesarDatos();
              this.getView().setModel(oModel);
              var Input = ctx.getView().byId("eanInput");
              setTimeout(function () {
                Input.focus();
              }, 0);
            } else if (cantidadYRuta.cantidad == -2) {
              cantidadYRuta3 = await this.obtenerCantidadYRutaSobrante(
                sValue,
                1
              );
              if (cantidadYRuta3.cantidad > 0) {
                console.log("es un producto");
                // Actualiza el modelo
                oModel.setProperty("/ruta", cantidadYRuta3.ruta);
                oModel.setProperty("/cantidad", cantidadYRuta3.cantidad);
                oModel.setProperty(
                  "/cantidadAEscanear",
                  cantidadYRuta3.cantidad
                );
                oModel.setProperty("/ean", sValue);
                oModel.setProperty("/id", cantidadYRuta3.id);
                oModel.setProperty("/AdicChar2", cantidadYRuta.AdicChar2);
                oModel.setProperty("/Kgbrv", cantidadYRuta3.Kgbrv);
                oModel.setProperty("/M3v", cantidadYRuta3.M3v);
                // Actualiza la pantalla
                cantidad.setText(cantidadYRuta3.cantidad);
                sRuta.setText(cantidadYRuta3.ruta);
                sRuta.setText(cantidadYRuta3.display);
                descripcion.setText(cantidadYRuta3.descripcion);
                //  Ean.setValue(cantidadYRuta.ean);
                Ean.setValue("");
                ci.setText(cantidadYRuta3.ci);
                parcialButton.setEnabled(true);
                oModel.setProperty("/Kgbrv", cantidadYRuta3.Kgbrv);
                oModel.setProperty("/M3v", cantidadYRuta.M3v);

                oModel.setProperty("/ultimoProdScan", cantidadYRuta3.ci);
                oModel.setProperty(
                  "/descUltimoProdScan",
                  cantidadYRuta3.descripcion
                );
                localStorage.setItem("ultimoProdScan", cantidadYRuta3.ci);
                localStorage.setItem(
                  "descUltimoProdScan",
                  cantidadYRuta3.descripcion
                );
                await this.obtenerYProcesarDatos();
                this.getView().setModel(oModel);
                var Input = ctx.getView().byId("eanInput");
                setTimeout(function () {
                  Input.focus();
                }, 0);
              } else {
                var Ean = this.getView().byId("eanInput");
                var ci = this.getView().byId("edtCI");
                ci.setText(cantidadYRuta.ci);
                oModel.setProperty("/ultimoProdScan", cantidadYRuta.ci);
                oModel.setProperty(
                  "/descUltimoProdScan",
                  cantidadYRuta.descripcion
                );
                console.log(" Error: Producto sobrante");
                await this.obtenerYProcesarDatos();

                MessageBox.error(
                  "ERROR. este producto no puede asignarse a ninguna ruta. Producto sobrante",
                  {
                    title: "Error ",
                    styleClass: "customMessageBox", // Aplica la clase CSS personalizada
                    onClose: function () {
                      Ean.setValue("");
                      console.log("Mensaje de error personalizado cerrado.");
                    },
                  }
                );
              }
            } else {
              cantidadYRuta = await this.obtenerCantidadYRuta(sValue, 2); // no es un producto( EAN) verifica si es un CI
              if (cantidadYRuta.cantidad > 0) {
                //////////
                // Buscar todas las combinaciones posibles en IndexedDB
                var registros = await new Promise((resolve, reject) => {
                  var request = indexedDB.open("ventilado", 5);
                  request.onsuccess = function (event) {
                    var db = event.target.result;
                    var transaction = db.transaction(["ventilado"], "readonly");
                    var objectStore = transaction.objectStore("ventilado");
                    var index = objectStore.index("CodigoInterno");
                    var cursorRequest = index.openCursor(
                      IDBKeyRange.only(sValue)
                    );
                    var resultados = [];
                    cursorRequest.onsuccess = function (event) {
                      var cursor = event.target.result;
                      if (cursor) {
                        resultados.push(cursor.value);
                        cursor.continue();
                      } else {
                        // Filtrar combinaciones únicas de CodigoInterno y M3teo
                        var unicos = [];
                        var combinaciones = new Set();
                        resultados.forEach(function (item) {
                          var clave = item.CodigoInterno + "_" + item.M3teo;
                          if (!combinaciones.has(clave)) {
                            combinaciones.add(clave);
                            unicos.push(item);
                          }
                        });
                        resolve(unicos);
                      }
                    };
                    cursorRequest.onerror = function (event) {
                      reject(event.target.error);
                    };
                  };
                  request.onerror = function (event) {
                    reject(event.target.error);
                  };
                });
                if (registros.length > 1) {
                  // Esperar a que el usuario elija una opción
                  var seleccion = await new Promise((resolve) => {
                    var oView = this.getView();
                    var oDialog = new sap.m.Dialog({
                      title: "Seleccione una combinación",
                      content: [
                        new sap.m.List({
                          items: registros.map(function (item) {
                            return new sap.m.StandardListItem({
                              title:
                                "Presentacion: " +
                                item.M3teo +
                                " | EAN: " +
                                item.Ean,
                              description: item.Descricion,
                              type: "Active",
                              press: function () {
                                oDialog.close();
                                resolve(item); // Resuelve la promesa con el item elegido
                              },
                            });
                          }),
                        }),
                      ],
                      endButton: new sap.m.Button({
                        text: "Cancelar",
                        press: function () {
                          oDialog.close();
                          resolve(null); // Resuelve la promesa con null si cancela
                        },
                      }),
                      afterClose: function () {
                        oDialog.destroy();
                      },
                    });
                    oView.addDependent(oDialog);
                    oDialog.open();
                  });

                  if (seleccion) {
                    var mainInput = this.getView().byId("edtCI");
                    mainInput.setText(seleccion.CodigoInterno);
                    var eanInput = this.byId("eanInput");
                    var edtTipo = this.byId("edtTipo");
                    edtTipo.setText(seleccion.M3teo);
                    eanInput.setValue(seleccion.Ean);
                    this.handleEanEnter(seleccion.Ean);
                  } else {
                    // El usuario canceló
                    this.byId("dialogoCI").close();
                  }
                }

                /////////
                // Actualiza el modelo
                console.log("es un ci");
                oModel.setProperty("/ruta", cantidadYRuta.ruta);
                oModel.setProperty("/cantidad", cantidadYRuta.cantidad);
                oModel.setProperty(
                  "/cantidadAEscanear",
                  cantidadYRuta.cantidad
                );
                oModel.setProperty("/ean", cantidadYRuta.ean);
                oModel.setProperty("/id", cantidadYRuta.id);
                oModel.setProperty("/ci", cantidadYRuta.ci);
                oModel.setProperty("/Kgbrv", cantidadYRuta.Kgbrv);
                oModel.setProperty("/M3v", cantidadYRuta.M3v);
                // Actualiza la pantalla
                var edtTipo = this.getView().byId("edtTipo");
                edtTipo.setText(cantidadYRuta.M3teo);
                cantidad.setText(cantidadYRuta.cantidad);
                sRuta.setText(cantidadYRuta.ruta);
                sRuta.setText(cantidadYRuta.display);
                descripcion.setText(cantidadYRuta.descripcion);
                //Ean.setValue(cantidadYRuta.ean);
                Ean.setValue("");
                ci.setText(cantidadYRuta.ci);
                parcialButton.setEnabled(true);

                oModel.setProperty("/ultimoProdScan", cantidadYRuta.ci);
                oModel.setProperty(
                  "/descUltimoProdScan",
                  cantidadYRuta.descripcion
                );
                localStorage.setItem("ultimoProdScan", cantidadYRuta.ci);
                localStorage.setItem(
                  "descUltimoProdScan",
                  cantidadYRuta.descripcion
                );
                await this.obtenerYProcesarDatos();
                this.getView().setModel(oModel);
                var Input = ctx.getView().byId("eanInput");
                setTimeout(function () {
                  Input.focus();
                }, 0);
              } else {
                // no es ni producto ni CI, comprobar si es un codigo de confirmacion
                if (cantidadYRuta.cantidad == -1) {
                  cantidadYRuta3 = await this.obtenerCantidadYRutaSobrante(
                    sValue,
                    2
                  );
                  if (cantidadYRuta3.cantidad > 0) {
                    console.log("es un producto");

                    // Actualiza el modelo
                    oModel.setProperty("/ruta", cantidadYRuta3.ruta);
                    oModel.setProperty("/cantidad", cantidadYRuta3.cantidad);
                    oModel.setProperty(
                      "/cantidadAEscanear",
                      cantidadYRuta3.cantidad
                    );
                    oModel.setProperty("/ean", sValue);
                    oModel.setProperty("/id", cantidadYRuta3.id);
                    oModel.setProperty("/AdicChar2", cantidadYRuta.AdicChar2);
                    oModel.setProperty("/Kgbrv", cantidadYRuta3.Kgbrv);
                    oModel.setProperty("/M3v", cantidadYRuta3.M3v);
                    // Actualiza la pantalla
                    cantidad.setText(cantidadYRuta3.cantidad);
                    sRuta.setText(cantidadYRuta3.ruta);
                    sRuta.setText(cantidadYRuta3.display);
                    descripcion.setText(cantidadYRuta3.descripcion);
                    //  Ean.setValue(cantidadYRuta.ean);
                    Ean.setValue("");
                    ci.setText(cantidadYRuta3.ci);
                    parcialButton.setEnabled(true);
                    oModel.setProperty("/Kgbrv", cantidadYRuta3.Kgbrv);
                    oModel.setProperty("/M3v", cantidadYRuta.M3v);

                    oModel.setProperty("/ultimoProdScan", cantidadYRuta3.ci);
                    oModel.setProperty(
                      "/descUltimoProdScan",
                      cantidadYRuta3.descripcion
                    );
                    localStorage.setItem("ultimoProdScan", cantidadYRuta3.ci);
                    localStorage.setItem(
                      "descUltimoProdScan",
                      cantidadYRuta3.descripcion
                    );
                    await this.obtenerYProcesarDatos();
                    //    this.getView().setModel(oModel);
                    var Input = ctx.getView().byId("eanInput");
                    setTimeout(function () {
                      Input.focus();
                    }, 0);
                  } else {
                    var Ean = this.getView().byId("eanInput");
                    var ci = this.getView().byId("edtCI");
                    ci.setText(cantidadYRuta.ci);
                    oModel.setProperty("/ultimoProdScan", cantidadYRuta.ci);
                    oModel.setProperty(
                      "/descUltimoProdScan",
                      cantidadYRuta.descripcion
                    );
                    console.log(" Error: Producto sobrante");
                    await this.obtenerYProcesarDatos();
                    MessageBox.error(
                      "ERROR. este producto no puede asignarse a ninguna ruta. Producto sobrante",
                      {
                        title: "Error ",
                        styleClass: "customMessageBox", // Aplica la clase CSS personalizada
                        onClose: function () {
                          Ean.setValue("");
                          console.log(
                            "Mensaje de error personalizado cerrado."
                          );
                        },
                      }
                    );
                  }
                } else if (cantidadYRuta.cantidad == -3) {
                  console.log(" Error no se conoce el valor ingresado");
                  var Ean = this.getView().byId("eanInput");

                  MessageBox.error(
                    "ERROR.El valor ingresado, no corresponde a un producto de este transporte ni a una ruta",
                    {
                      title: "Error ",
                      styleClass: "customMessageBox", // Aplica la clase CSS personalizada
                      onClose: function () {
                        Ean.setValue("");
                        console.log("Mensaje de error personalizado cerrado.");
                      },
                    }
                  );
                }
              }
            }
          } catch (error) {
            console.error("Error al obtener la cantidad y la ruta:", error);
          }
        } else {
          // entro un codigo y el modelo no esta vacio, tiene que entrar un codigo de confirmacion
          var ruta = this._findRouteByEAN(sValue);
          if (ruta) {
            console.log("es una confirmacion");
            const tableData =
              this.getView().getModel().getProperty("/tableData") || [];
            const registroRuta = tableData.find((item) => item.Ruta === ruta);

            const objetoPTL = {
              rutaId: ruta,
              cantidadConfirmada: registroRuta.TOT || 1, // 👈 Usamos la cantidad original asignada
            };
            procesa_confirmacion = 1;

            ctx.procesarRutaConfirmadaDesdePTL(objetoPTL);
            Ean.setValue("");
            // es la confirmacion al ciclo actual
            // resetea valores para iniciar el nuevo ciclo
            /*   var scant = oModel.getProperty("/cantidad");
                                   if (ruta == oModel.getProperty("/ruta")) {
                                       oModel.setProperty("/ruta", 0);
               
                                       oModel.setProperty("/ean", "");
                                       // oModel.setProperty("/ultimoProdScan", oModel.getProperty("/ci"));
                                       // oModel.setProperty("/descUltimoProdScan", descripcion.getText());
                                       oModel.setProperty("/ci", "");
                                       oModel.setProperty("/descripcion", "");
                                       var m3v = parseFloat(oModel.getProperty("/M3v")) || 0;
                                       var Kgbrv = parseFloat(oModel.getProperty("/Kgbrv")) || 0;
               
                                       var cantidadAEscanear = parseInt(oModel.getProperty("/cantidadAEscanear")) || 1; // Asegúrate de no dividir por cero
               
                                       //actualiza el estado 
                                       var request = indexedDB.open("ventilado", 5);
               
                                       var id = oModel.getProperty("/id");
               
                                       request.onsuccess = function (event) {
                                           var db = event.target.result;
                                           ctx._dbConnections.push(db); // Guardar referencia a la conexión abierta
                                           // Llamar a la función para actualizar el campo 'Estado'
                                           // Incrementar y asignar el nuevo valor de AdicChar2
                                           maxAdicChar2 = maxAdicChar2 + 1;
               
                                           // Realizar la operación matemática
                                           var resultadoM3r = (m3v * scant) / cantidadAEscanear;
               
                                           // Redondear a 1 decimal
                                           // resultadoM3r = Math.round(resultadoM3r * 10) / 100;
               
                                           // Formatear el resultado para que tenga longitud 5
                                           var resultadoFormateadoM3r = resultadoM3r.toFixed(3).padStart(5, ' ');
               
                                           // Realizar la operación matemática
                                           var resultadoKgbrr = (Kgbrv * scant) / cantidadAEscanear;
               
                                           // Formatear el resultado para que tenga longitud 5
                                           var resultadoFormateadoKgbrr = resultadoKgbrr.toFixed(1).padStart(5, ' ');
               
               
                                           ctx.actualizarEstado(db, id, "Completo", scant, String(maxAdicChar2), ctx.getFormattedDateTime(), resultadoFormateadoKgbrr, resultadoFormateadoM3r);
                                       };
                                       oModel.setProperty("/id", 0);
                                       oModel.setProperty("/cantidad", 0);
                                       oModel.setProperty("/cantidadAEscanear", 0);
                                       cantidad.setText("");
                                       sRuta.setText("");
                                       descripcion.setText("");
                                       Ean.setValue("");
                                       ci.setText("");
                                       oModel.setProperty("/Kgbrv", '');
                                       oModel.setProperty("/M3v", '');
                                       // Actualizar tableData
                                       var tableData = oModel.getProperty("/tableData");
                                       // Buscar el registro correspondiente en tableData
                                       tableData.forEach(function (registro) {
                                           if (registro.Ruta === ruta) {
                                               registro.SCAN = Number(registro.SCAN) || 0;
                                               registro.SCAN = Number(scant);
                                               registro.FALTA = registro.FALTA - Number(scant);
                                           }
                                       });
                                       var totalScan = oModel.getProperty("/totalScan");
                                       //totalScan = totalScan + Number(scant);
                                       totalScan = Number(scant);
                                       var totalFalta = oModel.getProperty("/totalFalta");
                                       totalFalta = totalFalta - Number(scant);
               
                                       // Establecer el array actualizado en el modelo
                                       oModel.setProperty("/tableData", tableData);
                                       oModel.setProperty("/totalScan", totalScan);
                                       oModel.setProperty("/totalFalta", totalFalta);
                                       this.getView().setModel(oModel);
               
                                       var Input = ctx.getView().byId("eanInput");
                                       setTimeout(function () {
                                           Input.focus();
                                       }, 0);
                                   }
               
                                   else {
               
                                       var Ean = this.getView().byId("eanInput");
               
                                       MessageBox.error("Error : Esta confirmando en una ruta equivocada, tiene que hacelo en la ruta " + oModel.getProperty("/ruta"), {
                                           title: "Error ",
                                           styleClass: "customMessageBox", // Aplica la clase CSS personalizada
                                           onClose: function () {
                                               Ean.setValue('');
                                               console.log("Mensaje de error personalizado cerrado.");
                                           }
                                       });
                                   }*/
          } else {
            var Ean = this.getView().byId("eanInput");
            procesa_confirmacion = 1;
            MessageBox.error(
              "Error : Tiene que ingresar un codigo de confirmacion de ruta",
              {
                title: "Error ",
                styleClass: "customMessageBox", // Aplica la clase CSS personalizada
                onClose: function () {
                  Ean.setValue("");
                  console.log("Mensaje de error personalizado cerrado.");
                },
              }
            );
          }
        }
        if (procesa_confirmacion == 0) {
          let datos = await this.obtenerDatosDeIndexedDB();
          //veo si esta completo el escaneo
          // Sumar el total de CantEscaneada y CantidadEntrega
          const { totalEscaneada, totalEntrega } = datos.reduce(
            (totales, item) => {
              totales.totalEscaneada += item.CantEscaneada || 0;
              totales.totalEntrega += item.CantidadEntrega || 0;
              return totales;
            },
            { totalEscaneada: 0, totalEntrega: 0 }
          );
          // Calcular la diferencia entre ambos totales
          completo = totalEntrega - totalEscaneada;
          if (completo == 0) {
            this.getView().byId("eanInput").setVisible(false);
            this.getView().byId("parcialButton").setEnabled(false);
          }

          var oModel = this.getView().getModel();
          oModel.setProperty("/isArrowVisible", true);
          var descripcion = this.getView().byId("lDescripcion");
          MessageToast.show("Valor ingresado: " + sValue);
          /**** Inicio Agregado para  PTL ******** */
          this.enviarDatosAPickToLine();
          /********* fin */
          this.getView().setModel(oModel);
        }
      },

      /***     Encuentra la ruta a partir del EAN  */
      _findRouteByEAN: function (ean) {
        var oLocalModel = this.getView().getModel();
        var aCodConfirmacionData = oLocalModel.getProperty(
          "/codConfirmacionData"
        );

        // Buscar el EAN en el array de datos
        var foundItem = aCodConfirmacionData.find(function (item) {
          return item.Ean === ean;
        });

        if (foundItem) {
          return foundItem.Ruta;
        } else {
          console.log("EAN no encontrado.");
          return null;
        }
      },

      /** Lee del backend los codigos EAN de las rutas y los pasa a un array local */
      _fetchCodConfirmacionData: async function () {
        var oModel = new sap.ui.model.odata.v2.ODataModel(
          "/sap/opu/odata/sap/ZVENTILADO_SRV/"
        );

        try {
          const oData = await new Promise((resolve, reject) => {
            oModel.read("/CodConfirmacionSet", {
              success: function (oData) {
                resolve(oData);
              },
              error: function (oError) {
                reject(oError);
              },
            });
          });

          var oLocalModel = this.getView().getModel();

          // Verificar si oData.results es un array
          var codConfirmacionData = Array.isArray(oData.results)
            ? oData.results
            : [oData.results];

          // Guardar los datos en el modelo local
          oLocalModel.setProperty("/codConfirmacionData", codConfirmacionData);

          console.log("Datos copiados con éxito.");

          return codConfirmacionData;
        } catch (oError) {
          console.error("Error al leer datos del servicio OData:", oError);
          return [];
        }
      },
      _fetchCodConfirmacionData2: function () {
        var oModel = new sap.ui.model.odata.v2.ODataModel(
          "/sap/opu/odata/sap/ZVENTILADO_SRV/"
        );

        oModel.read("/CodConfirmacionSet", {
          success: function (oData) {
            // var oLocalModel = this.getView().getModel("localModel");
            var oLocalModel = this.getView().getModel();
            // Verificar si oData.results es un array
            if (Array.isArray(oData.results)) {
              // Si es un array, guardar todos los items en el modelo local
              oLocalModel.setProperty("/codConfirmacionData", oData.results); // guarda los codigos en el modelo local
            } else {
              // Si no es un array, manejar el único item directamente
              var item = oData.results;
              oLocalModel.setProperty("/codConfirmacionData", [item]); // guarda los codigos en el modelo local
            }
            console.log("Datos copiados con éxito.");
          }.bind(this),
          error: function (oError) {
            console.error("Error al leer datos del servicio OData:", oError);
          },
        });
      },

      actualizarEstado: function (
        db,
        id,
        nuevoEstado,
        cant,
        AdicChar2,
        fechaHora,
        kgbrr,
        M3r
      ) {
        ctx = this;
        var transaction = db.transaction(["ventilado"], "readwrite");
        var objectStore = transaction.objectStore("ventilado");

        var getRequest = objectStore.get(id); // consulta la base x el registro que tiene el id pasado

        getRequest.onsuccess = function (event) {
          var data = event.target.result; // recupera el registro
          if (data) {
            // Actualizar el campo 'Estado'
            var cant2 = cant;
            data.Estado = nuevoEstado;
            data.CantEscaneada = cant2;
            data.AdicChar2 = AdicChar2;
            data.AdicDec2 = fechaHora;
            data.Preparador = sUsuario;
            data.AdicDec1 = sPuesto;
            data.Kgbrr = kgbrr;
            data.M3r = M3r;
            // Guardar el registro actualizado
            var updateRequest = objectStore.put(data);
            updateRequest.onsuccess = function (event) {
              // si se guardo satisfactoriamente vengo x aca
              console.log(
                "El campo 'Estado' ha sido actualizado exitosamente."
              );
              // Verificar que el campo 'Estado' ha sido actualizado correctamente
              var verifyRequest = objectStore.get(id);
              verifyRequest.onsuccess = function (event) {
                var updatedData = event.target.result;
                console.log(
                  "Valor actualizado del campo 'Estado':",
                  updatedData.Estado
                );

                ctx.oActualizarBackEnd(
                  id,
                  nuevoEstado,
                  cant,
                  AdicChar2,
                  fechaHora,
                  sUsuario,
                  sPuesto,
                  kgbrr,
                  M3r
                );
                /* ctx.recalcularDatosDeModelo();
                                             ctx.verificarCicloCompletado();*/
                ctx.recalcularDatosDeModelo().then(function () {
                  ctx.verificarCicloCompletado();
                });
              };
              verifyRequest.onerror = function (event) {
                // si hay un error al guardar el dato , voy x aca
                console.log(
                  "Error al verificar el campo 'Estado':",
                  event.target.error
                );
              };
            };

            updateRequest.onerror = function (event) {
              // si hay error al recuperar el registro voy x aca
              console.log(
                "Error al actualizar el campo 'Estado':",
                event.target.error
              );
            };
          } else {
            // si no se encuentra el registro voy x aca
            console.log(
              "No se encontró ningún registro con el Id proporcionado."
            );
          }
        };
      },
      oActualizarBackEnd: function (
        id,
        estado,
        cantidad,
        AdicChar2,
        fechaHora,
        sUsuario,
        sPuesto,
        kgbrr,
        M3r
      ) {
        var updatedData = [
          {
            Id: id,
            Estado: estado,
            CantEscaneada: cantidad,
            AdicChar2: AdicChar2,
            AdicDec2: fechaHora,
            Preparador: sUsuario,
            AdicDec1: sPuesto,
            Kgbrr: kgbrr,
            M3r: M3r,
          },
        ];
        this.crud("ACTUALIZAR", "ventilado", id, updatedData, "");
      },

      //   Aca se hacen los calculos para mostrar los numeros GRANDES de la pantalla
      obtenerCantidadYRuta: async function (eanInput, busqueda) {
        try {
          var datos = await this.onGetData(eanInput, busqueda); // Realiza una sola lectura de la tabla
          return {
            cantidad: datos.Cantidad,
            ruta: datos.Ruta,
            descripcion: datos.descripcion,
            id: datos.id,
            ean: datos.ean,
            ci: datos.ci,
            AdicChar2: datos.AdicChar2,
            Kgbrv: datos.Kgbrv,
            M3v: datos.M3v,
            display: datos.DISPLAY,
            M3teo: datos.tipo,
          }; // Devuelve un objeto con la cantidad y la ruta
        } catch (error) {
          // console.error("Error al obtener la cantidad y la ruta:", error);
          return { cantidad: -3, ruta: -1, descripcion: "" }; // o cualquier otro valor predeterminado si lo prefieres
        }
      },
      obtenerCantidadYRutaSobrante: async function (eanInput, busqueda) {
        try {
          var datos = await this.onGetData3(eanInput, busqueda); // Realiza una sola lectura de la tabla
          return {
            cantidad: datos.Cantidad,
            ruta: datos.Ruta,
            descripcion: datos.descripcion,
            id: datos.id,
            ean: datos.ean,
            ci: datos.ci,
            AdicChar2: datos.AdicChar2,
            Kgbrv: datos.Kgbrv,
            M3v: datos.M3v,
            display: datos.DISPLAY,
          }; // Devuelve un objeto con la cantidad y la ruta
        } catch (error) {
          // console.error("Error al obtener la cantidad y la ruta:", error);
          return { cantidad: -3, ruta: -1, descripcion: "" }; // o cualquier otro valor predeterminado si lo prefieres
        }
      },

      //********* fin escaneo **************************/
      //******* Abre pagina de ventilado- Cierre */
      onCierrePress: function () {},
      //*******  Funcion para descargar las etiquetas  ****** */
      onGeneratePDF: function () {
        ctx2 = this;
        //Paramos el reloj
        this.getOwnerComponent().stopClockAndClearStorage();
        //Actualizamos el campo duracionFinal
        var oModel = new sap.ui.model.odata.v2.ODataModel(
          "/sap/opu/odata/sap/ZVENTILADO_SRV/",
          {
            useBatch: false,
            defaultBindingMode: "TwoWay",
          }
        );
        // Primero, buscar si ya existe el registro
        var aFilters = [
          new sap.ui.model.Filter(
            "Transporte",
            sap.ui.model.FilterOperator.EQ,
            sReparto
          ),
        ];
        // Crear registro en zlog_ventiladoSet para cierre
        var now = new Date();
        var sHoraActual = now.toTimeString().slice(0, 8); // "HH:MM:SS"
        var sODataHoraActual =
          "PT" +
          sHoraActual.split(":")[0] +
          "H" +
          sHoraActual.split(":")[1] +
          "M" +
          sHoraActual.split(":")[2] +
          "S";
        var sODataFechafin = "/Date(" + now.getTime() + ")/";

        var sTransporte = (function () {
          var fullText = ctx2.byId("transporte").getText();
          var code = fullText.replace("Reparto: ", "").trim();
          return code.padStart(10, "0");
        })();

        var centroValue = localStorage.getItem("depositoCod") || "";
        var preparadorValue = localStorage.getItem("sPreparador") || "";
        var entregaValue = localStorage.getItem("sPtoPlanif") || "";

        var oEntry = {
          Id: 0,
          EventoNro: 0,
          ScanNro: 0,
          Ean: "",
          CodigoInterno: "",
          Descripcion: "",
          Ruta: "",
          TipoLog: "IMPRESION",
          Entrega: entregaValue,
          Centro: centroValue,
          Preparador: preparadorValue,
          Hora: sODataHoraActual,
          Fecha: sODataFechafin,
          Cliente: "",
          Estacion: (function () {
            var fullText = ctx2.byId("puestoScan").getText();
            var code = fullText.replace("Estacion de trabajo Nro: ", "").trim();
            return code;
          })(),
          Transporte: sTransporte,
          CantAsignada: 0,
          ConfirmadoEnRuta: "",
        };
        oModel.create("/zlog_ventiladoSet", oEntry, {
          error: function (err) {
            MessageBox.error("Error al crear el evento de cierre.");
          },
        });

        var oModel = new sap.ui.model.odata.v2.ODataModel(
          "/sap/opu/odata/sap/ZVENTILADO_SRV/",
          {
            useBatch: false, // Deshabilitar batch requests, actualizo de a un registro.
          }
        );
        //Se envian los datos para las etiquetas

        ctx = this.getView(); //guardo el contexto

        var sServiceURL = oModel.sServiceUrl;
        var sSource =
          sServiceURL + "/sFormSet(Fname='" + sReparto + "')/$value";
        // Crear y abrir el PDFViewer
        var opdfViewer = new sap.m.PDFViewer();
        ctx.addDependent(opdfViewer);
        opdfViewer.setSource(sSource);
        opdfViewer.setTitle("Etiquetas del Reparto");
        opdfViewer.open();
      },
      onGeneratePDF_back: function () {
        var oModel = new sap.ui.model.odata.v2.ODataModel(
          "/sap/opu/odata/sap/ZVENTILADO_SRV/",
          {
            useBatch: false, // Deshabilitar batch requests, actualizo de a un registro.
          }
        );
        //Se envian los datos para las etiquetas

        var oData = {
          Dni: 1,
          Nombre: "value2",
          Apellido: "erere",
        };
        ctx = this.getView(); //guardo el contexto
        oModel.create("/zpruebaSet", oData, {
          success: function (oData, response) {
            // Después de que se cree la entidad con éxito, genera la URL para el PDF
            var sServiceURL = oModel.sServiceUrl;
            //var sSource = sServiceURL + "/sFormSet(Fname='ZETIQUETAS')/$value";
            var sSource =
              sServiceURL + "/sFormSet(Fname='" + sTransporte + "')/$value";
            // Fname='" + sFname + "',FnameNew ='" + sTransporte + "'
            // Crear y abrir el PDFViewer
            var opdfViewer = new sap.m.PDFViewer();
            ctx.addDependent(opdfViewer);
            opdfViewer.setSource(sSource);
            opdfViewer.setTitle("Etiquetas del Reparto");
            opdfViewer.open();
          }.bind(this),
          error: function (oError) {
            sap.m.MessageToast.show("Error al enviar datos al backend");
          },
        });
      },

      //********* */ fin  descarga de etiquetas   ********/
      onOpenTransport: function () {
        var oViewModel = this.getView().getModel();
        oViewModel.setProperty("/showPasswordInput", true);
      },
      onPasswordSubmit: function () {
        var oViewModel = this.getView().getModel();
        var sPassword = this.getView().byId("password").getValue();
        if (sPassword === "12345") {
          // Reemplazar con la lógica real de validación
          /////
          var aData = oViewModel.setProperty("/tableData2");
          console.log("Updated Data: ", oViewModel.getProperty("/tableData"));
          var request = indexedDB.open("ventilado", 5);
          // var id=  oViewModel.getProperty("/id");
          request.onsuccess = function (event) {
            var db = event.target.result;
            ctx._dbConnections.push(db); // Guardar referencia a la conexión abierta
            // Iterar sobre cada elemento de tableData y actualizar en IndexedDB
            aData.forEach(function (item) {
              // Llamar a la función para actualizar  estado del transporte
              ctx.actualizarCantCubReales(
                db,
                indice,
                nuevoCubR,
                nuevoValorPa,
                ""
              );
              ctx.byId("dialogoStop").close();
              var oModel = ctx.getView().getModel();
              oViewModel.setProperty("/estadoDelTransporte", "");
              oViewModel.setProperty("/isClosed", true);
              oViewModel.setProperty("/showPasswordInput", false);
              oViewModel.setProperty("/printEtiquetas", true);
            });
          };

          /////
          oViewModel.setProperty("/isClosed", false);
          oViewModel.setProperty("/showPasswordInput", false);
          MessageToast.show("Transporte abierto con éxito.");
        } else {
          MessageBox.error(
            "Error :Contrasena incorrecta. Por favor, intentelo de nuevo.",
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

      // Método para abrir el diálogo del código interno
      onOpenCodeInputDialog: function () {
        //Cargamos el Dialogo
        var oView = this.getView();
        if (!this.byId("dialogoCI")) {
          // load asynchronous XML fragment
          Fragment.load({
            id: oView.getId(),
            name: "ventilado.ventiladoptl.view.CodeInputDialog", // todo el camino incluido el nombre del XML
            controller: this,
          }).then(function (oDialog) {
            // connect dialog to the root view
            //of this component (models, lifecycle)
            oView.addDependent(oDialog);
            oDialog.open();
          });
        } else {
          this.byId("dialogoCI").open();
        }
      },

      // Método para manejar la confirmación del valor ingresado en el diálogo del código interno
      /*   onCodeInputConfirm: async function () {
        var codeInput = this.byId("codeInput");
        var inputValue = codeInput.getValue();

        // Transferir el valor ingresado al campo de entrada principal
        var mainInput = this.getView().byId("edtCI");
        mainInput.setText(inputValue);
        //Buscar en la base de datos

        this.byId("dialogoCI").close();
        //  buscar  el EAN del codigo interno ingresado y poner el valor de EAN en el eanInput
        var datos = await this.onGetData2(inputValue);
        var eanInput = this.byId("eanInput");
        eanInput.setValue(datos.ean); // Muestra valor de EAN recuperado
        // Llamar a la función handleEanEnter
        this.handleEanEnter(datos.ean);
      }, */

      // Método para manejar el evento afterClose del diálogo
      onCodeInputDialogClose: function (oEvent) {
        // Limpiar el campo de entrada del diálogo
        var codeInput = this.byId("codeInput");
        codeInput.setValue("");
        // Devolver el foco al input del EAN
        var eanInput = this.byId("eanInput");
        eanInput.focus();
      },

      onPessParcialDialog: function () {
        //Cargamos el Dialogo
        var oView = this.getView();
        if (!this.byId("parcial")) {
          // load asynchronous XML fragment
          Fragment.load({
            id: oView.getId(),
            name: "ventilado.ventiladoptl.view.ParcialDialog",
            controller: this,
          }).then(function (oDialog) {
            // connect dialog to the root view
            //of this component (models, lifecycle)
            oView.addDependent(oDialog);
            oDialog.open();
          });
        } else {
          this.byId("dialogoParcial").open();
        }
      },

      // Método para manejar la confirmación del valor ingresado en el diálogo del código interno
      onParcialConfirm: function () {
        var parcial = this.byId("parcial");
        var inputValue = parcial.getValue();

        // Transferir el valor ingresado  a la logica

        this.byId("dialogoParcial").close();
      },

      // Método para manejar el evento afterClose del diálogo
      onParcialDialogClose: function (oEvent) {
        // Limpiar el campo de entrada del diálogo
        var parcial = this.byId("parcial");
        parcial.setValue("");
        // Devolver el foco al input del EAN
        var eanInput = this.byId("eanInput");
        eanInput.focus();
      },

      // Método para abrir el diálogo Stop
      onStopDialog: function () {
        if (completo != 0) {
          var oModel = new ODataModel("/sap/opu/odata/sap/ZVENTILADO_SRV/");
          var aFilters = [];
          aFilters.push(
            new Filter(
              "Transporte",
              FilterOperator.EQ,
              localStorage.getItem("sReparto")
            )
          );
          ctx = this;
          oModel.read("/zdesafectacionSet", {
            filters: aFilters,
            success: function (oData) {
              if (oData.results.length === 0) {
                // Mostrar un MessageBox con un botón "OK"
                sap.m.MessageBox.alert(
                  "Tiene que desafectar el transporte antes de cerrarlo",
                  {
                    title: "Atencion",
                    icon: sap.m.MessageBox.Icon.ERROR,
                  }
                );
              } else {
                // ctx = this;
                //Vemos el estado del  Transporte
                var oModel = ctx.getView().getModel();
                //Cargamos el Dialogo
                var oView = ctx.getView();
                if (!ctx.byId("dialogoStop")) {
                  // load asynchronous XML fragment
                  Fragment.load({
                    id: oView.getId(),
                    name: "ventilado.ventiladoptl.view.StopDialog",
                    controller: ctx,
                  }).then(function (oDialog) {
                    // connect dialog to the root view
                    //of this component (models, lifecycle)
                    oView.addDependent(oDialog);
                    oDialog.open();
                  });
                } else {
                  ctx.byId("dialogoStop").open();
                }
              }
            },
            error: function (oError) {
              console.error("Error al leer datos del servicio OData:", oError);
            },
          });
        } else {
          //Vemos el estado del  Transporte
          var oModel = ctx.getView().getModel();
          //Cargamos el Dialogo
          var oView = ctx.getView();
          if (!ctx.byId("dialogoStop")) {
            // load asynchronous XML fragment
            Fragment.load({
              id: oView.getId(),
              name: "ventilado.ventiladoptl.view.StopDialog",
              controller: ctx,
            }).then(function (oDialog) {
              // connect dialog to the root view
              //of this component (models, lifecycle)
              oView.addDependent(oDialog);
              oDialog.open();
            });
          } else {
            ctx.byId("dialogoStop").open();
          }
        }
      },

      onRealCubetasChange: function (oEvent) {
        const oInput = oEvent.getSource();
        const sPath = oInput.getBindingContext().getPath(); // Obtener el índice del elemento
        const oModel = this.getView().getModel();

        // Actualizar el valor ingresado en el modelo
        const sValue = parseFloat(oEvent.getParameter("value")) || 0;
        oModel.setProperty(sPath + "/C Real", sValue);

        // Recalcular el total de Cubetas Reales
        const aData = oModel.getProperty("/tableData3");
        const totalCubetas = aData.reduce(
          (sum, item) => sum + (parseFloat(item["C Real"]) || 0),
          0
        );
        oModel.setProperty("/realCubetasTotal", "Total: " + totalCubetas);
      },

      onPalletsChange: function (oEvent) {
        const oInput = oEvent.getSource();
        const sPath = oInput.getBindingContext().getPath(); // Obtener el índice del elemento
        const oModel = this.getView().getModel();

        // Actualizar el valor ingresado en el modelo
        const sValue = parseFloat(oEvent.getParameter("value")) || 0;
        oModel.setProperty(sPath + "/Pa", sValue);

        // Recalcular el total de Pallets
        const aData = oModel.getProperty("/tableData3");
        const totalPallets = aData.reduce(
          (sum, item) => sum + (parseFloat(item["Pa"]) || 0),
          0
        );
        oModel.setProperty("/realPalletsTotal", "Total: " + totalPallets);
      },

      onRollsChange: function (oEvent) {
        const oInput = oEvent.getSource();
        const sPath = oInput.getBindingContext().getPath(); // Obtener el índice del elemento
        const oModel = this.getView().getModel();

        // Actualizar el valor ingresado en el modelo
        const sValue = parseFloat(oEvent.getParameter("value")) || 0;
        oModel.setProperty(sPath + "/Ro", sValue);

        // Recalcular el total de Rolls
        const aData = oModel.getProperty("/tableData3");
        const totalRolls = aData.reduce(
          (sum, item) => sum + (parseFloat(item["Ro"]) || 0),
          0
        );
        oModel.setProperty("/realRollsTotal", "Total: " + totalRolls);
      },

      // Método para manejar la confirmación del valor ingresado en el diálogo Stop
      onStopConfirm: function () {
        if (this.intervalId) {
          clearInterval(this.intervalId);
        }

        this.elapsedTime = 0;
        this.startTime = null;
        var oModel = this.getView().getModel();
        oModel.setProperty("/scanState", "Stopped");
        oModel.setProperty("/stateClass", this._getStateClass("Stopped"));
        oModel.setProperty("/elapsedTime", 0);
        oModel.setProperty("/formattedElapsedTime", "00:00:00");

        // Clear saved state from local storage
        localStorage.removeItem("elapsedTime");
        localStorage.removeItem("scanState");

        var oTable = this.byId("customTable2");
        var aItems = oTable.getItems();
        var oModel = this.getView().getModel();
        var aData = oModel.getProperty("/tableData3");
        var bValid = true;
        // Variables para totales
        var totalCubetas = 0;
        var totalPallets = 0;
        var totalRolls = 0;
        var totalFilas = aItems.length;
        aItems.forEach(function (oItem, index) {
          var oCells = oItem.getCells();
          // Verificar que al menos uno de los valores sea mayor a cero ( cubetas reales o pallets)
          if (oCells[8].getValue() <= 0 && oCells[9].getValue() <= 0) {
            bValid = false;
          }

          var cubetas = Number(oCells[8].getValue()) || 0;
          var pallets = Number(oCells[9].getValue()) || 0;
          var rolls = Number(oCells[10].getValue()) || 0;
          totalCubetas += cubetas;
          totalPallets += pallets;
          totalRolls += rolls;
          aData[index]["C Real"] = cubetas;
          aData[index]["Pa"] = pallets;
          aData[index]["Ro"] = rolls;
        });
        // Setear variables en el modelo antes de salir
        oModel.setProperty("/totalCubetas", totalCubetas);
        oModel.setProperty("/totalPallets", totalPallets);
        oModel.setProperty("/totalRolls", totalRolls);
        oModel.setProperty("/totalFilas", totalFilas);

        //Actualizar log de transporte

        var oModel = new sap.ui.model.odata.v2.ODataModel(
          "/sap/opu/odata/sap/ZVENTILADO_SRV/",
          {
            useBatch: false,
            defaultBindingMode: "TwoWay",
          }
        );
        // Primero, buscar si ya existe el registro
        var aFilters = [
          new sap.ui.model.Filter(
            "Transporte",
            sap.ui.model.FilterOperator.EQ,
            sReparto
          ),
        ];
        oModel.read("/ZVENTILADO_KPISet", {
          filters: aFilters,
          success: function (oData) {
            if (oData.results && oData.results.length > 0) {
              // Hay al menos un registro, actualizamos Inicioescaneo
              var registro = oData.results[0];
              var oUpdate = [
                {
                  Id: registro.Id,
                  Cantidadcubeta: totalCubetas,
                  Cantidadroll: totalRolls,
                  Cantidadpallet: totalPallets,
                },
              ];

              ctx.crud(
                "ACTUALIZAR",
                "ZVENTILADO_KPI",
                registro.Id,
                oUpdate,
                ""
              );
            }
          },
          error: function (oError) {
            // No mostrar mensajes
          },
        });

        if (bValid) {
          oModel.setProperty("/tableData", aData);
          console.log("Updated Data: ", oModel.getProperty("/tableData"));
          var request = indexedDB.open("ventilado", 5);
          var id = oModel.getProperty("/id");
          request.onsuccess = function (event) {
            var db = event.target.result;
            ctx._dbConnections.push(db); // Guardar referencia a la conexión abierta
            // Iterar sobre cada elemento de tableData y actualizar en IndexedDB
            aData.forEach(function (item) {
              var indice = item.Ruta; // Usar el campo 'Ruta' como índice
              var nuevoCubR = Number(item["C Real"]); // Campo 'C Cub'
              var nuevoValorPa = Number(item["Pa"]); // Campo 'Pa'

              // Llamar a la función para actualizar el campo 'CubR y Pa' y el estado del transporte
              ctx.actualizarCantCubReales(
                db,
                indice,
                nuevoCubR,
                nuevoValorPa,
                "CERRADO"
              );
              ctx.byId("dialogoStop").close();
              var oModel = ctx.getView().getModel();
              oModel.setProperty("/estadoDelTransporte", "CERRADO");
              oModel.setProperty("/isClosed", true);
              oModel.setProperty("/showPasswordInput", false);
              oModel.setProperty("/printEtiquetas", true);
            });
          };
        } else {
          MessageBox.error(
            "Los campos 'C Real' y 'Pa' no pueden ser ambos cero. Por favor, introduce valores válidos.",
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

      actualizarCantCubReales: function (
        db,
        indice,
        nuevoCubR,
        nuevoValorPa,
        estado
      ) {
        ctx = this;
        var transaction = db.transaction(["ventilado"], "readwrite");
        var objectStore = transaction.objectStore("ventilado");
        var index = objectStore.index("LugarPDisp");
        var lugar_p_disp = indice; // Reemplaza esto con el valor que estás buscando

        index.openCursor(IDBKeyRange.only(lugar_p_disp)).onsuccess = function (
          event
        ) {
          var cursor = event.target.result;
          if (cursor) {
            var record = cursor.value;
            // Actualizar los campos Cubre y Pa con los nuevos valores
            record.Cubre = nuevoCubR;
            record.Pa = nuevoValorPa;
            record.AdicChar1 = estado;
            var id = record.Id;
            // Actualizar el registro en el object store
            var updateRequest = cursor.update(record);
            updateRequest.onsuccess = function () {
              console.log("Registro actualizado:", record);
              var updatedData = [
                {
                  Id: id,
                  Cubre: nuevoCubR,
                  Pa: nuevoValorPa,
                  AdicChar1: estado,
                },
              ];
              ctx.crud("ACTUALIZAR", "ventilado", id, updatedData, "");
            };
            updateRequest.onerror = function (event) {
              console.error(
                "Error al actualizar el registro:",
                event.target.errorCode
              );
            };

            cursor.continue(); // Continuar buscando más registros
          } else {
            console.log("No more records found or no records found");
          }
        };

        transaction.oncomplete = function () {
          console.log("Transacción completada.");
        };

        transaction.onerror = function (event) {
          console.error("Error en la transacción:", event.target.errorCode);
        };
      },
      // Método para manejar el evento afterClose del diálogo
      onStopDialogClose: function (oEvent) {},

      /******  Llamada ejemplo al CRUD  ****************
                                          
                                          onCrudCrear: function() {
                                              var createData = [
                                                  { "Dni": 2, "Nombre": "Nombre2", "Apellido": "Apellido2" },
                                                  { "Dni": 3, "Nombre": "Nombre3", "Apellido": "Apellido3" }
                                              ];
                                              this.crud("CREAR", "zprueba", createData, "");
                                          },
                                          onCrudUpdate: function() {
                                              var updatedData =[{ "Dni": 14, "Nombre": "NombAct10", "Apellido": "ApelliAo" },
                                                                { "Dni": 15, "Nombre": "NombAct11", "Apellido": "ApelliAct" }
                                              ] ;
                                              this.crud("ACTUALIZAR", "zprueba", updatedData, "");
                                          },         
                                  
                                          onCrudRead: function() {
                                              this.crud("READ", "ventilado", "", "");
                                             
                                          },
                                          onCrudBorrar: function() {
                                  
                                             // this.crud("BORRAR", "zprueba", "", "");
                                             this.crud("FI", "zprueba", "", "");
                                          },
                                  */

      //*******  Inicio  Funciones para el CRUD del oData *******/
      crud: function (operacion, tabla, id, oValor1, oValor2) {
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
        var sEntitySet = "/" + tabla + "Set";

        if (operacion == "READ") {
          // Configurar los filtros
          var aFilters = [];

          aFilters.push(new Filter("Transporte", FilterOperator.EQ, oValor1));
          aFilters.push(new Filter("Entrega", FilterOperator.EQ, oValor2));

          // Hacer la llamada OData

          oModel.read(sEntitySet, {
            filters: aFilters,
            success: function (oData) {
              // Manejar datos exitosamente
              console.log(oData);
            },
            error: function (oError) {
              // Manejar errores
              console.error(oError);
            },
          });
        } else if (operacion == "FI") {
          var sTransporte = sReparto; //"0000001060";
          var sPtoPlanificacion = sPtoPlanif; //"1700";
          oModel.callFunction("/GenerarTransporte", {
            method: "GET",
            urlParameters: {
              transporte: sTransporte, // Pass parameters directly as strings
              pto_planificacion: sPtoPlanificacion,
            },
            success: function (oData) {
              // Manejar éxito
              MessageToast.show("Se cargaron los datos para el ventilado");
              // Procesar la respuesta aquí
              var transporte = oData.Transporte;
              var entrega = oData.Entrega;
              var pto_planificacion = oData.Pto_planificacion;
              var estado = oData.Ean;

              // Aquí puedes trabajar con los datos recibidos
              console.log("Transporte: ", transporte);
              console.log("Pto Entrega: ", pto_planificacion);
              console.log("Entrega: ", entrega);
              console.log("Estado: ", estado);

              ctx.crud("READ", "ventilado", transporte, "1700"); // se leen los datos del transporte
            },
            error: function (oError) {
              // Manejar error
              var sErrorMessage = "";
              try {
                var oErrorResponse = JSON.parse(oError.responseText);
                sErrorMessage = oErrorResponse.error.message.value;
              } catch (e) {
                sErrorMessage = "Error desconocido";
              }
              MessageToast.show(sErrorMessage);
            },
          });
        } else if (operacion == "CREAR") {
          var createRecord = function (oEntry, onSuccess, onError) {
            var sEntitySet = "/" + tabla + "Set";
            oModel.create(sEntitySet, oEntry, {
              success: function () {
                //    MessageToast.show("Registro " + oEntry.Dni + " creado con éxito.");
                if (onSuccess) onSuccess();
              },
              error: function (oError) {
                MessageToast.show("Error al crear el registro " + oEntry.Dni);
                console.error(oError);
                if (onError) onError(oError);
              },
            });
          };

          var createNext = function (index) {
            if (index < oValor1.length) {
              createRecord(oValor1[index], function () {
                createNext(index + 1);
              });
            } else {
              MessageToast.show("Todos los registros se han creado con exito.");
            }
          }.bind(this);

          createNext(0);
        } else if (operacion == "ACTUALIZAR") {
          // Definir la función updateRecord

          var updateRecord = function (oEntry, onSuccess, onError) {
            // La ruta debe estar construida correctamente según el modelo y los datos
            var sEntitySet = "/" + tabla + "Set";
            var sPath = sEntitySet + "(" + oEntry.Id + ")"; // Ajusta esta ruta según tu modelo OData
            oModel.update(sPath, oEntry, {
              success: function () {
                //  MessageToast.show("Registro " + oEntry.Id + " actualizado con exito.");
                if (onSuccess) onSuccess();
              },
              error: function (oError) {
                MessageToast.show(
                  "Error al actualizar el registro " + oEntry.Dni
                );
                console.error(oError);
                if (onError) onError(oError);
              },
            });
          };

          // Función para actualizar los registros secuencialmente.
          var updateRecords = function (aData) {
            var updateNext = function (index) {
              if (index < aData.length) {
                updateRecord(aData[index], function () {
                  updateNext(index + 1);
                });
              } else {
                MessageToast.show(
                  "Todos los registros se han actualizado con éxito."
                );
              }
            }.bind(this);
            updateNext(0);
          };
          updateRecords(oValor1);
        } else if (operacion == "BORRAR") {
          // Define la función de éxito
          var onSuccessFunction = function () {
            console.log("Operación exitosa");
          };

          // Define la función de error
          var onErrorFunction = function (error) {
            console.error("Error:", error);
          };

          // Define la función deleteRecord
          var deleteRecord = function (
            dni,
            onSuccess,
            onError,
            additionalParameter
          ) {
            var sPath = "/zpruebaSet(" + id + ")";
            oModel.remove(sPath, {
              success: function () {
                MessageToast.show("Registro " + id + " eliminado con éxito.");
                if (onSuccess) onSuccess();
              },
              error: function (oError) {
                MessageToast.show("Error al eliminar el registro " + dni);
                console.error(oError);
                if (onError) onError(oError);
              },
            });

            // Ejemplo de uso del parámetro adicional
            console.log("Additional Parameter:", additionalParameter);
          };
        }
      },

      //******* Fin  Funciones para el CRUD  *******/
      _fetchAndStoreOData: function () {
        var oModel = new ODataModel("/sap/opu/odata/sap/ZVENTILADO_SRV/");
        //Se leen los datos del backend y se guardan en la base local
        oModel.read("/ventiladoSet", {
          success: function (oData) {
            var transaction = this.db.transaction(["ventilado"], "readwrite");
            var objectStore = transaction.objectStore("ventilado");

            oData.results.forEach(function (item) {
              objectStore.put(item);
            });

            console.log("Datos copiados con éxito.");
          }.bind(this),
          error: function (oError) {
            console.error("Error al leer datos del servicio OData:", oError);
          },
        });
      },

      onGetData3: function (key, busqueda) {
        // busqueda =1 busca si es un producto
        // busqueda =2 busca si es un codigo interno
        ctx = this;
        var result;
        var resultArray = [];
        var sKey = key;
        var flag = 0;
        return new Promise(
          function (resolve, reject) {
            var index;
            var request = indexedDB.open("ventilado", 5); // Asegúrate de usar la misma versión

            request.onsuccess = function (event) {
              var db = event.target.result;
              ctx._dbConnections.push(db); // Guardar referencia a la conexión abierta
              var transaction = db.transaction(["ventilado"], "readonly");
              var objectStore = transaction.objectStore("ventilado");
              if (busqueda == 1) {
                // Verificar si el índice "Ean" existe
                if (!objectStore.indexNames.contains("Ean")) {
                  console.error("El índice 'Ean' no se encontró.");
                  return;
                }
                index = objectStore.index("Ean");
              } else {
                // Verificar si el índice "CodigoInterno" existe
                if (!objectStore.indexNames.contains("CodigoInterno")) {
                  console.error("El índice 'CodigoInterno' no se encontró.");
                  return;
                }
                index = objectStore.index("CodigoInterno");
              }
              var cursorRequest = index.openCursor(IDBKeyRange.only(sKey));
              var resultArray = [];
              var codi = "";
              var desc = "";
              cursorRequest.onsuccess = function (event) {
                var cursor = event.target.result;
                if (cursor) {
                  flag = 1;
                  var data = cursor.value;
                  desc = data.Descricion;
                  codi = data.CodigoInterno;

                  // Agregar solo los registros cuyo Estado no es "Completo" al array
                  if (data.Estado == "Completo") {
                    resultArray.push(data);
                  }

                  // Avanzar al siguiente registro
                  cursor.continue();
                } else {
                  // Si no hay más registros, proceder a ordenar y devolver el primer registro incompleto

                  // Ordenar el array por CodigoInterno y luego por LugarPDisp (convertido a número)
                  resultArray.sort(function (a, b) {
                    if (a.CodigoInterno === b.CodigoInterno) {
                      return (
                        parseInt(a.LugarPDisp, 10) - parseInt(b.LugarPDisp, 10)
                      );
                    }
                    return a.CodigoInterno.localeCompare(b.CodigoInterno);
                  });

                  // Devolver el primer registro que no esté completo
                  for (var i = 0; i < resultArray.length; i++) {
                    var data = resultArray[i];
                    if (data.CantidadEntrega != data.CantEscaneada) {
                      var cant = data.CantidadEntrega - data.CantEscaneada;
                      var result = {
                        Cantidad: cant,
                        Ruta: data.LugarPDisp,
                        descripcion: data.Descricion,
                        id: data.Id,
                        ean: data.Ean,
                        ci: data.CodigoInterno,
                        AdicChar2: data.AdicChar2,
                        Kgbrv: data.Kgbrv,
                        M3v: data.M3v,
                        DISPLAY: data.display.replace("dsp-", ""),
                      };
                      flag = 2;
                      resolve(result);
                      return;
                    }
                  }

                  if (flag == 1 && busqueda == 1) {
                    // console.log("Es un producto pero sobra");
                    result = {
                      Cantidad: -2,
                      Ruta: 0,
                      descripcion: desc,
                      id: 0,
                      ci: codi,
                    };
                    resolve(result);
                    return;
                  } else if (flag == 1 && busqueda == 2) {
                    result = {
                      Cantidad: -1,
                      Ruta: 0,
                      descripcion: desc,
                      id: 0,
                      ci: codi,
                    };
                    resolve(result);
                    return;
                  } else if (flag == 0 && (busqueda == 1 || busqueda == 2)) {
                    // console.log("No Es un producto ");
                    result = {
                      Cantidad: -3,
                      Ruta: 0,
                      descripcion: "",
                      id: 0,
                      ci: key,
                    };
                    resolve(result);
                    return;
                  }
                }
              };
              cursorRequest.onerror = function (event) {
                console.log("Error al buscar el registro:", event.target.error);
              };
            };
            request.onerror = function (event) {
              console.log(
                "Error al abrir la base de datos:",
                event.target.error
              );
            };
          }.bind(this)
        );
      },
      onGetData: function (key, busqueda) {
        // busqueda =1 busca si es un producto
        // busqueda =2 busca si es un codigo interno
        ctx = this;
        var result;
        var resultArray = [];
        var sKey = key;
        var flag = 0;
        return new Promise(
          function (resolve, reject) {
            var index;
            var request = indexedDB.open("ventilado", 5); // Asegúrate de usar la misma versión

            request.onsuccess = function (event) {
              var db = event.target.result;
              ctx._dbConnections.push(db); // Guardar referencia a la conexión abierta
              var transaction = db.transaction(["ventilado"], "readonly");
              var objectStore = transaction.objectStore("ventilado");
              if (busqueda == 1) {
                // Verificar si el índice "Ean" existe
                if (!objectStore.indexNames.contains("Ean")) {
                  console.error("El índice 'Ean' no se encontró.");
                  return;
                }
                index = objectStore.index("Ean");
                // nuevo
                var cursorRequest = index.openCursor(IDBKeyRange.only(sKey));
              } else {
                // Verificar si el índice "CodigoInterno" existe
                if (!objectStore.indexNames.contains("CodigoInterno")) {
                  console.error("El índice 'CodigoInterno' no se encontró.");
                  return;
                }
                index = objectStore.index("CodigoInterno");
              }
              var cursorRequest = index.openCursor(IDBKeyRange.only(sKey));
              var resultArray = [];
              var codi = "";
              var desc = "";
              cursorRequest.onsuccess = function (event) {
                var cursor = event.target.result;
                if (cursor) {
                  flag = 1;
                  var data = cursor.value;
                  desc = data.Descricion;
                  codi = data.CodigoInterno;

                  // Agregar solo los registros cuyo Estado no es "Completo" al array
                  if (data.Estado != "Completo") {
                    resultArray.push(data);
                  }

                  // Avanzar al siguiente registro
                  cursor.continue();
                } else {
                  // Si no hay más registros, proceder a ordenar y devolver el primer registro incompleto

                  // Ordenar el array por CodigoInterno y luego por LugarPDisp (convertido a número)
                  /*  resultArray.sort(function (a, b) {
                                                                       if (a.CodigoInterno === b.CodigoInterno) {
                                                                           return parseInt(a.LugarPDisp, 10) - parseInt(b.LugarPDisp, 10);
                                                                       }
                                                                       return a.CodigoInterno.localeCompare(b.CodigoInterno);
                                                                   }); */
                  resultArray.sort(function (a, b) {
                    if (a.CodigoInterno === b.CodigoInterno) {
                      return (
                        ctx._getDisplayNumber(a.display) -
                        ctx._getDisplayNumber(b.display)
                      );
                    }
                    return a.CodigoInterno.localeCompare(b.CodigoInterno);
                  });

                  // Devolver el primer registro que no esté completo
                  for (var i = 0; i < resultArray.length; i++) {
                    var data = resultArray[i];
                    if (data.Estado != "Completo") {
                      var result = {
                        Cantidad: data.CantidadEntrega,
                        Ruta: data.LugarPDisp,
                        descripcion: data.Descricion,
                        id: data.Id,
                        ean: data.Ean,
                        ci: data.CodigoInterno,
                        AdicChar2: data.AdicChar2,
                        Kgbrv: data.Kgbrv,
                        M3v: data.M3v,
                        DISPLAY: data.display.replace("dsp-", ""),
                        tipo: data.M3teo,
                      };
                      flag = 2;
                      resolve(result);
                      return;
                    }
                  }

                  if (flag == 1 && busqueda == 1) {
                    // console.log("Es un producto pero sobra");
                    result = {
                      Cantidad: -2,
                      Ruta: 0,
                      descripcion: desc,
                      id: 0,
                      ci: codi,
                    };
                    resolve(result);
                    return;
                  } else if (flag == 1 && busqueda == 2) {
                    result = {
                      Cantidad: -1,
                      Ruta: 0,
                      descripcion: desc,
                      id: 0,
                      ci: codi,
                    };
                    resolve(result);
                    return;
                  } else if (flag == 0 && (busqueda == 1 || busqueda == 2)) {
                    // console.log("No Es un producto ");
                    result = {
                      Cantidad: -3,
                      Ruta: 0,
                      descripcion: "",
                      id: 0,
                      ci: key,
                    };
                    resolve(result);
                    return;
                  }
                }
              };
              cursorRequest.onerror = function (event) {
                console.log("Error al buscar el registro:", event.target.error);
              };
            };
            request.onerror = function (event) {
              console.log(
                "Error al abrir la base de datos:",
                event.target.error
              );
            };
          }.bind(this)
        );
      },
      //***** Método para abrir el diálogo en caso de errores *************/
      onOpenDialog: function (msg1, msg2, msg3) {
        //Cargamos el Dialogo
        var oView = this.getView();
        if (!this.byId("codeDialog")) {
          // load asynchronous XML fragment
          Fragment.load({
            id: oView.getId(),
            name: "ventilado.ventiladoptl.view.CodeDialog", // todo el camino incluido el nombre del XML
            controller: this,
          }).then(function (oDialog) {
            // connect dialog to the root view
            //of this component (models, lifecycle)
            oView.addDependent(oDialog);
            oDialog.open();
            // Accedemos a los labels dentro del VBox
            var aContent = oDialog.getContent()[0].getItems(); // Asumimos que VBox es el primer y único contenido del diálogo

            if (aContent && aContent.length >= 3) {
              aContent[0].setText(msg1); // Primer Label
              aContent[1].setText(msg2); // Segundo Label
              aContent[2].setText(msg3); // Tercer Label
            }
          });
        } else {
          var oDialog = this.byId("codeDialog");

          // Accedemos a los labels dentro del VBox
          var aContent = oDialog.getContent()[0].getItems(); // Asumimos que VBox es el primer y único contenido del diálogo

          if (aContent && aContent.length >= 3) {
            aContent[0].setText(msg1); // Primer Label
            aContent[1].setText(msg2); // Segundo Label
            aContent[2].setText(msg3); // Tercer Label
          }
          oDialog.open();
        }
      },

      // Método para manejar la confirmación del valor ingresado en el diálogo del código interno
      onCodeConfirm: async function () {
        this.byId("codeDialog").close();
      },

      // Método para manejar el evento afterClose del diálogo
      onCodeInputDialogClose: function (oEvent) {
        // Devolver el foco al input del EAN
        var eanInput = this.byId("eanInput");
        eanInput.focus();
      },
      //////
      /*
                                  onDeleteData: function () {
                                      var transaction = this.db.transaction(["ventilado"], "readwrite");
                                      var objectStore = transaction.objectStore("ventilado");
                                      var requestDelete = objectStore.delete("1234567890");
                                  
                                      requestDelete.onsuccess = function (event) {
                                          console.log("Dato eliminado con éxito.");
                                      };
                                  
                                      requestDelete.onerror = function (event) {
                                          console.error("Error al eliminar el dato:", event.target.errorCode);
                                      };
                                  },*/
      /********* Función general para manejar operaciones CRUD de la BD Local y devolver una promesa *****/
      manejarCRUD: function (operacion, datos, campoBusqueda = "id") {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open("ventilado", 5);

          request.onupgradeneeded = function (event) {
            const db = event.target.result;
            ctx._dbConnections.push(db); // Guardar referencia a la conexión abierta
            if (!db.objectStoreNames.contains("ventilado")) {
              const objectStore = db.createObjectStore("ventilado", {
                keyPath: "id",
              });
              objectStore.createIndex("nombre", "nombre", { unique: false });
            }
          };

          request.onsuccess = function (event) {
            const db = event.target.result;
            const transaction = db.transaction(["ventilado"], "readwrite");
            const objectStore = transaction.objectStore("ventilado");
            let req;

            switch (operacion) {
              case "crear":
                req = objectStore.add(datos);
                break;

              case "leer":
                req =
                  campoBusqueda === "id"
                    ? objectStore.get(datos.id)
                    : objectStore
                        .index(campoBusqueda)
                        .get(datos[campoBusqueda]);
                break;

              case "actualizar":
                if (campoBusqueda === "id") {
                  req = objectStore.put(datos);
                } else {
                  const getReq = objectStore
                    .index(campoBusqueda)
                    .get(datos[campoBusqueda]);
                  getReq.onsuccess = function (event) {
                    const item = event.target.result;
                    if (item) {
                      Object.assign(item, datos);
                      const updateReq = objectStore.put(item);
                      updateReq.onsuccess = () => resolve(updateReq.result);
                      updateReq.onerror = (event) =>
                        reject(
                          new Error(
                            `Error en la operación ${operacion}: ${event.target.error}`
                          )
                        );
                    } else {
                      reject(
                        new Error("Elemento no encontrado para actualizar")
                      );
                    }
                  };
                  getReq.onerror = (event) =>
                    reject(
                      new Error(
                        `Error al buscar para actualizar: ${event.target.error}`
                      )
                    );
                  return;
                }
                break;

              case "eliminar":
                if (campoBusqueda === "id") {
                  req = objectStore.delete(datos.id);
                } else {
                  const getReq = objectStore
                    .index(campoBusqueda)
                    .getKey(datos[campoBusqueda]);
                  getReq.onsuccess = function (event) {
                    const key = event.target.result;
                    if (key !== undefined) {
                      const deleteReq = objectStore.delete(key);
                      deleteReq.onsuccess = () => resolve(deleteReq.result);
                      deleteReq.onerror = (event) =>
                        reject(
                          new Error(
                            `Error en la operación ${operacion}: ${event.target.error}`
                          )
                        );
                    } else {
                      reject(new Error("Elemento no encontrado para eliminar"));
                    }
                  };
                  getReq.onerror = (event) =>
                    reject(
                      new Error(
                        `Error al buscar para eliminar: ${event.target.error}`
                      )
                    );
                  return;
                }
                break;

              default:
                reject(new Error("Operación no válida"));
                return;
            }

            req.onsuccess = function () {
              resolve(req.result);
            };

            req.onerror = function (event) {
              reject(
                new Error(
                  `Error en la operación ${operacion}: ${event.target.error}`
                )
              );
            };
          };

          request.onerror = function (event) {
            reject(
              new Error(
                `Error al abrir la base de datos: ${event.target.error}`
              )
            );
          };
        });
      },

      // Ejemplo de funciones para operaciones CRUD
      crearElemento: async function (datos) {
        try {
          const resultado = await manejarCRUD("crear", datos);
          console.log("Elemento creado con éxito:", resultado);
        } catch (error) {
          console.error("Error al crear el elemento:", error);
        }
      },

      leerElemento: async function (campoBusqueda, valorBusqueda) {
        try {
          const resultado = await manejarCRUD(
            "leer",
            { [campoBusqueda]: valorBusqueda },
            campoBusqueda
          );
          console.log("Elemento leído:", resultado);
        } catch (error) {
          console.error("Error al leer el elemento:", error);
        }
      },

      actualizarElemento: async function (
        campoBusqueda,
        valorBusqueda,
        nuevosDatos
      ) {
        try {
          const elemento = await manejarCRUD(
            "leer",
            { [campoBusqueda]: valorBusqueda },
            campoBusqueda
          );
          if (elemento) {
            Object.assign(elemento, nuevosDatos);
            await manejarCRUD("actualizar", elemento);
            console.log("Elemento actualizado con éxito");
          } else {
            console.log("Elemento no encontrado");
          }
        } catch (error) {
          console.error("Error al actualizar el elemento:", error);
        }
      },

      eliminarElemento: async function (campoBusqueda, valorBusqueda) {
        try {
          await manejarCRUD(
            "eliminar",
            { [campoBusqueda]: valorBusqueda },
            campoBusqueda
          );
          console.log("Elemento eliminado con éxito");
        } catch (error) {
          console.error("Error al eliminar el elemento:", error);
        }
      },
      /* 
                                   // Ejemplos de uso
                                   crearElemento({ id: 1, nombre: "Elemento1" });
                                   leerElemento("id", 1);
                                   actualizarElemento("nombre", "Elemento1", { nombre: "Elemento1Modificado" });
                                   eliminarElemento("nombre", "Elemento1Modificado");*/

      /******   Cuando se sale de la pagina se cierran todas las conexiones a la base local */
      onExit: function () {
        this.closeAllDbConnections(); // Cerrar todas las conexiones cuando se cierre el controlador
        localStorage.setItem("elapsedTime", this.elapsedTime.toString());
      },

      closeAllDbConnections: function () {
        this._dbConnections.forEach((db) => {
          db.close();
        });
        this._dbConnections = []; // Resetear el array de conexiones
      },
      _handleUnload: function () {
        this.closeAllDbConnections();
        localStorage.setItem("elapsedTime", this.elapsedTime.toString());
        localStorage.setItem("elapsedTime", this.elapsedTime.toString());
        /*         this.onPause(); */
      },
      getFormattedDateTime: function () {
        var oDate = new Date();

        var day = String(oDate.getDate()).padStart(2, "0");
        var month = String(oDate.getMonth() + 1).padStart(2, "0"); // Enero es 0
        var year = String(oDate.getFullYear());

        var hours = String(oDate.getHours()).padStart(2, "0");
        var minutes = String(oDate.getMinutes()).padStart(2, "0");
        var seconds = String(oDate.getSeconds()).padStart(2, "0");

        return (
          day +
          "/" +
          month +
          "/" +
          year +
          " " +
          hours +
          ":" +
          minutes +
          ":" +
          seconds
        );
      },
      /***  codigopara el reloj */
      _getStateClass: function (state) {
        switch (state) {
          case "Running":
            return "running";
          case "Paused":
            return "paused";
          case "Stopped":
            return "stopped";
          default:
            return "stopped";
        }
      },

      _updateFormattedTime: function () {
        var oModel = this.getView().getModel();
        var scanState = oModel.getProperty("/scanState");

        if (scanState === "Running" && this.startTime !== null) {
          this.elapsedTime += (Date.now() - this.startTime) / 1000;
          this.startTime = Date.now();
        }

        var seconds = Math.floor(this.elapsedTime % 60);
        var minutes = Math.floor((this.elapsedTime / 60) % 60);
        var hours = Math.floor(this.elapsedTime / 3600);

        var formattedTime = [
          hours.toString().padStart(2, "0"),
          minutes.toString().padStart(2, "0"),
          seconds.toString().padStart(2, "0"),
        ].join(":");

        oModel.setProperty("/formattedElapsedTime", formattedTime);
        oModel.setProperty("/elapsedTime", this.elapsedTime);

        // Save state to local storage
        localStorage.setItem("elapsedTime", this.elapsedTime.toString());
        localStorage.setItem("scanState", scanState);
      },

      /*  onPause: function () {
                                       if (this.intervalId) {
                                           clearInterval(this.intervalId);
                                       }
                           
                                       this.startTime = null;
                                       var oModel = this.getView().getModel();
                                       oModel.setProperty("/scanState", "Paused");
                                       oModel.setProperty("/stateClass", this._getStateClass("Paused"));
                                       oModel.setProperty("/isStarted", false);
                                   }, */
      onPause: function () {
        const oClockModel = this.getOwnerComponent().getModel("clock");
        oClockModel.setProperty("/isRunning", false);
        localStorage.setItem(
          "clockData",
          JSON.stringify(oClockModel.getData())
        );
        clearInterval(this.getOwnerComponent()._clockInterval);
        this.getView().getModel().setProperty("/isStarted", false);

        // Crear log de pausa en zlog_ventiladoSet
        var ctx = this;
        var oModel = new sap.ui.model.odata.v2.ODataModel(
          "/sap/opu/odata/sap/ZVENTILADO_SRV/",
          {
            useBatch: false,
            defaultBindingMode: "TwoWay",
          }
        );
        var sTransporte = (function () {
          var fullText = ctx.byId("transporte").getText();
          var code = fullText.replace("Reparto: ", "").trim();
          return code.padStart(10, "0");
        })();
        var sTipoLog = "PAUSE";
        var now = new Date();
        var sHoraActual = now.toTimeString().slice(0, 8); // "HH:MM:SS"
        function toODataTime(timeStr) {
          var parts = timeStr.split(":");
          return "PT" + parts[0] + "H" + parts[1] + "M" + parts[2] + "S";
        }
        var sODataFechaInicio = "/Date(" + now.getTime() + ")/";
        var sODataHoraInicio = toODataTime(sHoraActual);
        var centroValue = localStorage.getItem("depositoCod") || "";
        var preparadorValue = localStorage.getItem("sPreparador") || "";
        var entregaValue = localStorage.getItem("sPtoPlanif") || "";

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
          Entrega: entregaValue,
          Centro: centroValue,
          Preparador: preparadorValue,
          Fecha: sODataFechaInicio,
          Cliente: "",
          Estacion: (function () {
            var fullText = ctx.byId("puestoScan").getText();
            var code = fullText.replace("Estacion de trabajo Nro: ", "").trim();
            return code;
          })(),
          Transporte: sTransporte,
          CantAsignada: 0,
          ConfirmadoEnRuta: "",
        };
        oModel.create("/zlog_ventiladoSet", oEntry, {
          error: function (err) {
            sap.m.MessageBox.error("Error al crear el evento de pausa.");
          },
        });
      },

      onStop: function () {
        if (this.intervalId) {
          clearInterval(this.intervalId);
        }

        this.startTime = null;
        var oModel = this.getView().getModel();
        oModel.setProperty("/scanState", "Stopped");
        oModel.setProperty("/stateClass", this._getStateClass("Stopped"));
      },

      onReset: function () {
        if (this.intervalId) {
          clearInterval(this.intervalId);
        }

        this.elapsedTime = 0;
        this.startTime = null;
        var oModel = this.getView().getModel();
        oModel.setProperty("/scanState", "Stopped");
        oModel.setProperty("/stateClass", this._getStateClass("Stopped"));
        oModel.setProperty("/elapsedTime", 0);
        oModel.setProperty("/formattedElapsedTime", "00:00:00");

        // Clear saved state from local storage
        localStorage.removeItem("elapsedTime");
        localStorage.removeItem("scanState");
      },
      /* Navegacion   */
      onNavToInicio: function () {
        /*         this.onPause(); */
        var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter.navTo("RouteView1");
      },
      onNavToAvanceRuta: function () {
        /*         this.onPause(); */
        var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter.navTo("Avance2");
      },
      onNavToAvanceCodigo: function () {
        /*         this.onPause(); */
        var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter.navTo("Avanceporci");
      },
      onDesafectacion: function () {
        //Arrancamos el reloj
        /*         const oClockModel = this.getOwnerComponent().getModel("clock");
        oClockModel.setProperty("/isRunning", true);
        localStorage.setItem(
          "clockData",
          JSON.stringify(oClockModel.getData())
        );
        this.getOwnerComponent()._startClockTimer(oClockModel); */

        /*         this.onPause(); */
        var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter.navTo("Desconsolidado"); //
      },

      onNavToLog: function () {
        this.onPause();
        var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        oRouter.navTo("Log");
      },

      /****** funciones agregadas para PTL********** */
      enviarDatosAPickToLine: function () {
        ctx = this;
        const oModel = this.getView().getModel();
        const tableData = oModel.getProperty("/tableData") || [];

        const payload = {
          workstationId: sPuesto,
          transporte: sReparto,
          producto: {
            codigo: oModel.getProperty("/ultimoProdScan"),
            descripcion: oModel.getProperty("/descUltimoProdScan"),
          },
          rutas: tableData.map((item) => ({
            //rutaId: item.Ruta,
            rutaId: item.Ruta.toString().padStart(2, "0"),
            cantidad: item.TOT,
            confirmado: Number(item.SCAN) || 0,
            displayId: ctx.obtenerDisplayId(item.Ruta, datosD),
          })),
        };
        oModel.setProperty(
          "/estadoMensaje",
          "Esperando respuesta de la API Pick to Line..."
        );
        fetch(`${PTL_API_URL}/encender`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
          .then((response) => response.json())
          .then(
            function (data) {
              if (data.status === "success") {
                MessageToast.show("Displays encendidos correctamente.");
                oModel.setProperty(
                  "/estadoMensaje",
                  "Esperando confirmación de rutas..."
                );
                ctx.iniciarPollingEstadoPTL(); // ✅ solo si encendido exitoso
              } else {
                MessageBox.error("Error al encender displays: " + data.message);
              }
            }.bind(this)
          ) // 🔧 preserve el this del controlador
          .catch((err) => {
            MessageBox.error(
              "Error de red al llamar a PickToLine API.\n\n" +
                "Por favor, verifique:\n" +
                "1. Que la maquina donde corre la API este encendida y accesible.\n" +
                "2. Que la conexión de red este activa (VPN, firewall, cables).\n" +
                "3. Si lo anterior es correcto, reinicie la maquina que contiene la API.\n" +
                "4. Vuelva a reiniciar el escaneo.",
              {
                title: "Error de red PickToLine",
                actions: [MessageBox.Action.CLOSE],
                emphasizedAction: MessageBox.Action.CLOSE,
                styleClass: "sapUiSizeCompact",
              }
            );
            ctx.byId("estadoMensaje").setVisible(false);
            console.error(err);
          });
      },

      obtenerDisplayId: function (ruta, datos) {
        let registro = datos.find((item) => item.LugarPDisp === ruta);

        if (registro) {
          return registro.display.toUpperCase(); //.Prodr.padStart(3, '0');
        } else {
          return "DSP-000"; // por defecto si no se encuentra
        }
      },

      iniciarPollingEstadoPTL: function () {
        ctx = this;
        const workstationId = sPuesto;
        const url = `${PTL_API_URL}/estado?workstationId=${workstationId}`;

        // Usamos un Set para llevar registro de rutas confirmadas y evitar repetir confirmaciones
        ctx._rutasConfirmadas = ctx._rutasConfirmadas || new Set();
        ctx._rutasConfirmadas.clear();
        // Limpiamos polling anterior si existe
        if (ctx._pollingInterval) {
          clearInterval(ctx._pollingInterval);
        }

        // Iniciar polling cada 3 segundos
        ctx._pollingInterval = setInterval(function () {
          fetch(url)
            .then(function (response) {
              if (!response.ok) {
                throw new Error(
                  "Error en la respuesta del polling: " + response.statusText
                );
              }
              return response.json();
            })
            .then(function (data) {
              if (data.estado && Array.isArray(data.estado)) {
                data.estado.forEach(function (ruta) {
                  // if (ruta.completada ) && !ctx._rutasConfirmadas.has(ruta.rutaId)) {
                  if (ruta.completada) {
                    //&& !ctx._rutasConfirmadas.has(String(parseInt(ruta.rutaId, 10)))) {
                    ctx.procesarRutaConfirmadaDesdePTL(ruta);
                    ctx._rutasConfirmadas.add(
                      String(parseInt(ruta.rutaId, 10))
                    );
                  }
                });
              }
            })
            .catch(function (err) {
              console.error("Error al hacer polling:", err);
            });
        }, 3000);
      },
      detenerPollingEstadoPTL: function () {
        ctx = this;
        if (ctx._pollingInterval) {
          clearInterval(ctx._pollingInterval);
          ctx._pollingInterval = null;
        }
        ctx._rutasConfirmadas = new Set();
      },

      procesarRutaConfirmadaDesdePTL: async function (ruta) {
        ctx = this;
        const oModel = this.getView().getModel();
        const tableData = oModel.getProperty("/tableData") || [];

        // Buscar el registro en la tabla por Ruta
        //const registro = tableData.find((item) => item.Ruta === ruta.rutaId);
        const registro = tableData.find(
          (item) => item.Ruta === String(parseInt(ruta.rutaId, 10))
        );
        if (!registro) {
          console.warn("Ruta no encontrada en modelo:", ruta.rutaId);
          return;
        }

        let cantidad = ruta.cantidadConfirmada;
        if (registro.SCAN > 0) {
          //   cantidad = ruta.cantidadConfirmada + registro.SCAN;
        }
        // ------------------------------------------------------------------
        // Actualizar SCAN (y de paso FALTA si la manejás) en /tableData
        // ------------------------------------------------------------------
        const idx = tableData.findIndex(
          (item) => item.Ruta === String(parseInt(ruta.rutaId, 10))
        ); //ruta.rutaId);   // posición en el array

        if (idx !== -1) {
          // 1) Marcar la cantidad escaneada
          oModel.setProperty(`/tableData/${idx}/SCAN`, cantidad);

          // 2) (Opcional) Recalcular FALTA si llevás ese campo
          const tot = oModel.getProperty(`/tableData/${idx}/TOT`) || 0;
          oModel.setProperty(
            `/tableData/${idx}/FALTA`,
            Math.max(tot - cantidad, 0)
          );
          /* ---------- 2. Recalcular los totales ---------- */
          const aTable = oModel.getProperty("/tableData") || [];
          const totalScan = aTable.reduce(
            (s, r) => s + (parseFloat(r.SCAN) || 0),
            0
          );
          const totalFalta = aTable.reduce(
            (s, r) => s + (parseFloat(r.FALTA) || 0),
            0
          );

          oModel.setProperty("/totalScan", totalScan);
          oModel.setProperty("/totalFalta", totalFalta);
          // 3) Forzar actualización de bindings si el modelo no tiene two‑way autobind
          oModel.refresh(true);
        }
        ///////////

        //const id = await this.buscarIdEnIndexedDBPorRuta(ruta.rutaId);  // Implementado más abajo
        const id = await this.buscarIdEnIndexedDBPorRuta(
          String(parseInt(ruta.rutaId, 10))
        ); // Implementado más abajo
        if (!id) {
          console.warn(
            "No se encontró ID en IndexedDB para la ruta:",
            ruta.rutaId
          );
          return;
        }

        const m3v = parseFloat(oModel.getProperty("/M3v")) || 0;
        const Kgbrv = parseFloat(oModel.getProperty("/Kgbrv")) || 0;
        const cantidadAEscanear =
          parseInt(oModel.getProperty("/cantidadAEscanear")) || 1;

        maxAdicChar2 = maxAdicChar2 + 1;

        const resultadoM3r = (m3v * cantidad) / cantidadAEscanear;
        const resultadoKgbrr = (Kgbrv * cantidad) / cantidadAEscanear;

        const resultadoFormateadoM3r = resultadoM3r.toFixed(3).padStart(5, " ");
        const resultadoFormateadoKgbrr = resultadoKgbrr
          .toFixed(1)
          .padStart(5, " ");

        const request = indexedDB.open("ventilado", 5);
        request.onsuccess = (event) => {
          const db = event.target.result;
          ctx.actualizarEstado(
            db,
            id,
            "Completo",
            cantidad,
            String(maxAdicChar2),
            this.getFormattedDateTime(),
            resultadoFormateadoKgbrr,
            resultadoFormateadoM3r
          );
          const oModel = this.getView().getModel();
          const tableData = oModel.getProperty("/tableData") || [];

          // Buscar el próximo item con scan === 0
          const siguienteItem = tableData.find(
            (item) => parseInt(item.SCAN) === 0
          );

          if (siguienteItem) {
            const cantidad = siguienteItem.FALTA; // o TOT si preferís
            const display = siguienteItem.DISPLAY || siguienteItem.Ruta || "";

            this.getView().byId("txtCantidad").setText(cantidad.toString());
            this.getView().byId("txtRuta").setText(display.replace("dsp-", ""));
          } else {
            // Si ya está todo completo
            this.getView().byId("txtCantidad").setText("");
            this.getView().byId("txtRuta").setText("");
          }

          /*  ctx.recalcularDatosDeModelo();
                                                ctx.verificarCicloCompletado();*/
        };
      },
      buscarIdEnIndexedDBPorRuta: function (rutaId) {
        const ciActual = this.byId("edtCI").getText(); // Obtener el producto actual
        return new Promise((resolve, reject) => {
          const request = indexedDB.open("ventilado", 5);
          request.onsuccess = function (event) {
            const db = event.target.result;
            const transaction = db.transaction(["ventilado"], "readonly");
            const objectStore = transaction.objectStore("ventilado");

            objectStore.openCursor().onsuccess = (event) => {
              const cursor = event.target.result;
              if (cursor) {
                const value = cursor.value;
                if (
                  value.LugarPDisp === rutaId &&
                  value.CodigoInterno === ciActual
                ) {
                  resolve(value.Id); // Devuelve el primer ID que coincida y no esté confirmado
                  return;
                }
                cursor.continue();
              } else {
                resolve(null); // No encontrado
              }
            };
          };
          request.onerror = () => reject(null);
        });
      },

      recalcularDatosDeModelo: function () {
        return this.obtenerDatosDeIndexedDB().then((datos) => {
          const datosPorRuta = this.procesarDatos(datos);
          const datosPorCI = this.procesarDatos2(datos);

          const oModel = this.getView().getModel();
          oModel.setProperty("/tableData", datosPorRuta);
          oModel.setProperty("/tableData2", datosPorCI);
        });
      },
      verificarCicloCompletado: function () {
        const oModel = ctx.getView().getModel();
        const tableData = oModel.getProperty("/tableData") || [];
        // const rutasPendientes = tableData.filter(item => item.SCAN === "0" || item.SCAN === 0);
        const rutasPendientes = tableData.filter(
          (item) => item.FALTA != "0" || item.FALTA != 0
        );
        if (rutasPendientes.length === 0) {
          clearInterval(this._pollingInterval);
          ctx._pollingInterval = null;
          ctx._rutasConfirmadas = new Set();
          ctx.byId("eanInput").setEnabled(true);
          MessageToast.show(
            "Producto confirmado en todas las rutas. Puede escanear uno nuevo."
          );
          oModel.setProperty("/ruta", 0); //para resetear el modelo viejo
          oModel.setProperty(
            "/estadoMensaje",
            "Producto confirmado en todas las rutas. Puede escanear uno nuevo."
          );
          // 🔻 Agregar llamada para apagar los displays
          //const sPuesto = oModel.getProperty("/puestoTrabajo");  // Asegúrate de tener este valor cargado
          fetch(
            `${PTL_API_URL}/apagar?workstationId=${encodeURIComponent(
              sPuesto
            )}`,
            {
              method: "POST",
            }
          )
            .then((response) => response.json())
            .then((data) => {
              MessageToast.show("Display apagados.");
            })
            .catch((err) => {
              console.error("Error de red al apagar displays:", err);
            });
        }
      },

      _getDisplayNumber: function (sDisplay) {
        return parseInt(String(sDisplay).replace(/^dsp-/, ""), 10) || 0;
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

      onCodeInputConfirm: async function () {
        var codeInput = this.byId("eanInput");
        var inputValue = codeInput.getValue();

        // Buscar todas las combinaciones posibles en IndexedDB
        var registros = await new Promise((resolve, reject) => {
          var request = indexedDB.open("ventilado", 5);
          request.onsuccess = function (event) {
            var db = event.target.result;
            var transaction = db.transaction(["ventilado"], "readonly");
            var objectStore = transaction.objectStore("ventilado");
            var index = objectStore.index("CodigoInterno");
            var cursorRequest = index.openCursor(IDBKeyRange.only(inputValue));
            var resultados = [];
            cursorRequest.onsuccess = function (event) {
              var cursor = event.target.result;
              if (cursor) {
                resultados.push(cursor.value);
                cursor.continue();
              } else {
                // Filtrar combinaciones únicas de CodigoInterno y M3teo
                var unicos = [];
                var combinaciones = new Set();
                resultados.forEach(function (item) {
                  var clave = item.CodigoInterno + "_" + item.M3teo;
                  if (!combinaciones.has(clave)) {
                    combinaciones.add(clave);
                    unicos.push(item);
                  }
                });
                resolve(unicos);
              }
            };
            cursorRequest.onerror = function (event) {
              reject(event.target.error);
            };
          };
          request.onerror = function (event) {
            reject(event.target.error);
          };
        });

        if (registros.length === 1) {
          // Solo una combinación, seguir como antes
          var mainInput = this.getView().byId("edtCI");
          mainInput.setText(inputValue);
          this.byId("dialogoCI").close();
          var datos = registros[0];
          var eanInput = this.byId("eanInput");
          eanInput.setValue(datos.Ean);
          this.handleEanEnter(datos.Ean);
        } else if (registros.length > 1) {
          // Más de una combinación, mostrar popup para elegir
          var oView = this.getView();
          var oDialog = new sap.m.Dialog({
            title: "Seleccione una combinación",
            content: [
              new sap.m.List({
                items: registros.map(function (item) {
                  return new sap.m.StandardListItem({
                    title: "M3teo: " + item.M3teo + " | EAN: " + item.Ean,
                    description: item.Descricion,
                    type: "Active",
                    press: function () {
                      oDialog.close();
                      var mainInput = oView.byId("edtCI");
                      mainInput.setText(item.CodigoInterno);
                      var eanInput = oView.byId("eanInput");
                      eanInput.setValue(item.Ean);
                      oView.getController().handleEanEnter(item.Ean);
                    },
                  });
                }),
              }),
            ],
            endButton: new sap.m.Button({
              text: "Cancelar",
              press: function () {
                oDialog.close();
              },
            }),
            afterClose: function () {
              oDialog.destroy();
            },
          });
          oView.addDependent(oDialog);
          oDialog.open();
        } else {
          // No se encontró ninguna combinación
          sap.m.MessageBox.error(
            "No se encontraron registros para el código ingresado."
          );
          this.byId("dialogoCI").close();
        }
      },
      ///////
    });
  }
);
