sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/odata/v2/ODataModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
  ],
  function (
    Controller,
    MessageToast,
    JSONModel,
    ODataModel,
    Filter,
    FilterOperator,
    MessageBox
  ) {
    "use strict";
    var ctx = this;
    var sTransporte;
    var sPuesto;
    var sReparto;
    var sPtoPlanif;
    var sUsuario;
    var sFecha;
    var datosD = [];

    return Controller.extend(
      "ventilado.ventiladoptl.controller.Desconsolidado",
      {
        onInit: function () {
          this._dbConnections = [];

          // 🟢 CREAR Y SETEAR EL MODELO ANTES DE TODO
          const oModel = new sap.ui.model.json.JSONModel({
            tableData: [],
            tableData2: [],
            displaysNoDisponibles: [],
            totalCantidadAsig: 0,
            totalTot: 0,
            totalScan: 0,
            totalFaltan: 0,
            totalKilo: 0,
            totalM3: 0,
            totalCubTeo: 0,
            contenedoresHabilitados: false,
          });
          this.getView().setModel(oModel);

          // 🔁 Conectar a la ruta y cargar datos
          const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
          oRouter.getRoute("Avance2").attachMatched(this.onRouteMatched, this);

          window.addEventListener(
            "beforeunload",
            this._handleUnload.bind(this)
          );
          window.addEventListener("popstate", this._handleUnload.bind(this));

          // Cargar los datos DESPUÉS de tener modelo listo
          this.ejecutarAcciones().catch((error) => {
            console.error("Error al ejecutar acciones iniciales:", error);
          });
        },

        onRouteMatched: function () {
          this.ejecutarAcciones().catch((error) => {
            console.error("Error al ejecutar acciones iniciales:", error);
          });
        },

        ejecutarAcciones: function () {
          ctx = this;
          sPuesto = localStorage.getItem("sPuesto");
          sReparto = localStorage.getItem("sReparto");
          sPtoPlanif = localStorage.getItem("sPtoPlanif");
          sUsuario = localStorage.getItem("sPreparador");

          return this.obtenerYProcesarDatos()
            .then(() => {
              const totalTot = ctx.datosD.reduce(
                (total, item) => total + (item.TOT || 0),
                0
              );
              const totalScan = ctx.datosD.reduce(
                (total, item) => total + (item.SCAN || 0),
                0
              );
              const totalFaltan = ctx.datosD.reduce(
                (total, item) => total + (item.FALTA || 0),
                0
              );
              const totalKilo = parseFloat(
                this.datosD
                  .reduce(
                    (total, item) => total + (parseFloat(item.KILO) || 0),
                    0
                  )
                  .toFixed(1)
              );
              const totalM3 = parseFloat(
                this.datosD
                  .reduce(
                    (total, item) => total + (parseFloat(item.M3) || 0),
                    0
                  )
                  .toFixed(3)
              );
              const totalCubTeo = ctx.datosD.reduce(
                (total, item) => total + (item.CubTEO || 0),
                0
              );

              // Asignar contenedor automático solo si no existe
              ctx.datosD.forEach((item) => {
                if (!item.contenedor) {
                  item.contenedor = this.determinarContenedor(item.CubTEO);
                }
              });

              // Calcular displays solo si no están definidos
              //this.datosD = this.calcularDisplays(this.datosD);
              const limite1 = parseInt(localStorage.getItem("limite1")) || 8;
              const limite2 = parseInt(localStorage.getItem("limite2")) || 12;
              const usarRoll = localStorage.getItem("usarRoll") === "true";

              const oModelDisplays = this.getView().getModel();

              // Leer los displays desactivados guardados por View1
              const displaysDesactivados = JSON.parse(
                localStorage.getItem("displaysDesactivados") || "[]"
              );

              // ✅ Guardarlos en el modelo de la vista para usarlos
              oModelDisplays.setProperty(
                "/displaysNoDisponibles",
                displaysDesactivados
              );

              const yaAsignadoAlguno = ctx.datosD.some(
                (item) => item.contenedor && item.display
              );

              if (yaAsignadoAlguno) {
                ctx.datosD = this.asignarContenedoresYDisplays(
                  ctx.datosD,
                  limite1,
                  limite2,
                  usarRoll,
                  true,
                  false
                );
              } else {
                ctx.datosD = this.asignarContenedoresYDisplays(
                  ctx.datosD,
                  limite1,
                  limite2,
                  usarRoll,
                  false,
                  false
                );
              }
              //ctx.datosD = this.asignarContenedoresYDisplays(ctx.datosD, limite1, limite2, usarRoll, false, false);

              if (ctx.excedioLimiteDisplays(this.datosD)) {
                const oView = this.getView();

                const inputLimite1 = new sap.m.Input({
                  value: limite1.toString(),
                  type: "Number",
                });

                const inputLimite2 = new sap.m.Input({
                  value: limite2.toString(),
                  type: "Number",
                });

                const checkboxRoll = new sap.m.CheckBox({
                  selected: usarRoll,
                  text: "Usar Roll Container",
                });

                const dialog = new sap.m.Dialog({
                  title: "Exceso de Displays",
                  type: "Message",
                  content: [
                    new sap.m.Label({
                      text: "Límite 1 (Cubetas hasta):",
                      labelFor: inputLimite1,
                    }),
                    inputLimite1,
                    new sap.m.Label({
                      text: "Límite 2 (Palets desde):",
                      labelFor: inputLimite2,
                    }),
                    inputLimite2,
                    checkboxRoll,
                  ],
                  beginButton: new sap.m.Button({
                    text: "Recalcular",
                    type: "Emphasized",
                    press: () => {
                      const nuevoL1 = parseInt(inputLimite1.getValue(), 10);
                      const nuevoL2 = parseInt(inputLimite2.getValue(), 10);
                      const nuevoUsarRoll = checkboxRoll.getSelected();

                      localStorage.setItem(
                        "limite1",
                        isNaN(nuevoL1) ? "8" : nuevoL1
                      );
                      localStorage.setItem(
                        "limite2",
                        isNaN(nuevoL2) ? "12" : nuevoL2
                      );
                      localStorage.setItem(
                        "usarRoll",
                        nuevoUsarRoll ? "true" : "false"
                      );

                      const recalculado = this.asignarContenedoresYDisplays(
                        this.datosD,
                        nuevoL1,
                        nuevoL2,
                        nuevoUsarRoll
                      );
                      const excedeAhora =
                        this.excedioLimiteDisplays(recalculado);

                      ctx.datosD = recalculado;
                      ctx
                        .getView()
                        .getModel()
                        .setProperty("/tableData", recalculado);
                      ctx
                        .getView()
                        .byId("btConfirmarContenedores")
                        .setEnabled(!excedeAhora);

                      if (excedeAhora) {
                        sap.m.MessageToast.show(
                          "Todavía se exceden las 30 posiciones."
                        );
                      } else {
                        sap.m.MessageToast.show(
                          "Asignacion recalculada correctamente."
                        );
                      }

                      dialog.close();
                    },
                  }),
                  endButton: new sap.m.Button({
                    text: "Cancelar",
                    press: () => {
                      dialog.close();
                    },
                  }),
                  afterClose: () => {
                    dialog.destroy();
                  },
                });

                dialog.open();

                // Desactivar botones mientras tanto
                oView.byId("btConfirmarContenedores").setEnabled(false);
                oView.byId("btScan2").setEnabled(false);
              }

              const oModel = this.getView().getModel();
              oModel.setProperty("/tableData", ctx.datosD);
              oModel.setProperty("/tableData2", ctx.datosD2);
              oModel.setProperty(
                "/totalCantidadAsig",
                ctx.datosD.reduce(
                  (total, item) => total + (item.cantidadAsig || 0),
                  0
                )
              );
              oModel.setProperty("/totalTot", totalTot);
              oModel.setProperty("/totalScan", totalScan);
              oModel.setProperty("/totalFaltan", totalFaltan);
              oModel.setProperty("/totalKilo", totalKilo);
              oModel.setProperty("/totalM3", totalM3);
              oModel.setProperty("/totalCubTeo", totalCubTeo);

              const yaConfirmado =
                localStorage.getItem("asignacionConfirmada") === "true";
              ctx
                .getView()
                .byId("btConfirmarContenedores")
                .setEnabled(!yaConfirmado);
              ctx.getView().byId("btScan2").setEnabled(yaConfirmado);
            })
            .catch((error) => {
              console.error("Error al obtener y procesar datos:", error);
            });
        },

        determinarContenedor: function (cubTeo) {
          const limite1 = 5;
          const limite2 = 10;

          if (cubTeo <= limite1) {
            return "CUB";
          } else if (
            localStorage.getItem("usarRoll") === "true" &&
            cubTeo > limite1 &&
            cubTeo <= limite2
          ) {
            return "ROLL";
          } else {
            return "PALLET";
          }
        },

        onChangeContenedor: function (oEvent) {
          if (localStorage.getItem("asignacionConfirmada") === "true") {
            sap.m.MessageToast.show(
              "Asignacion bloqueada. Activar modo administrador."
            );
            return;
          }

          const oComboBox = oEvent.getSource();
          const sNuevoContenedor = oComboBox.getSelectedKey();
          if (!sNuevoContenedor) return;

          const oModel = this.getView().getModel();
          const oContextData = oComboBox.getBindingContext().getObject();
          const idRuta = oContextData.Ruta;

          let aData = JSON.parse(
            JSON.stringify(oModel.getProperty("/tableData"))
          );

          // ✅ Actualizar la ruta correcta por ID (no por índice)
          aData.forEach((item) => {
            if (item.Ruta === idRuta) {
              item.contenedor = sNuevoContenedor;
            }
          });

          // Reordenar
          const tipoOrden = { CUB: 1, PALLET: 2, ROLL: 3 };
          aData.sort((a, b) => {
            if (tipoOrden[a.contenedor] !== tipoOrden[b.contenedor]) {
              return tipoOrden[a.contenedor] - tipoOrden[b.contenedor];
            }
            return parseInt(a.Ruta) - parseInt(b.Ruta);
          });

          // Recalcular displays
          const limite1 = parseInt(localStorage.getItem("limite1")) || 8;
          const limite2 = parseInt(localStorage.getItem("limite2")) || 12;
          const usarRoll = localStorage.getItem("usarRoll") === "true";
          const aRecalculado = this.asignarContenedoresYDisplays(
            aData,
            limite1,
            limite2,
            usarRoll,
            true, // <- respetarContenedorManual
            true // no ordenar
          );

          // Forzar cambio de foco
          oModel.setProperty("/tableData", []);
          sap.ui.getCore().applyChanges();

          setTimeout(() => {
            oModel.setProperty("/tableData", aRecalculado);

            const oTable = this.getView().byId("miTabla");
            oTable.bindItems(
              "/tableData",
              oTable.getBindingInfo("items").template
            );

            const excede = this.excedioLimiteDisplays(aRecalculado);
            this.getView().byId("btConfirmarContenedores").setEnabled(!excede);
            this.getView().byId("btScan2").setEnabled(false);
          }, 0);
        },

        onConfirmarContenedores: function () {
          this.getView()
            .getModel()
            .setProperty("/contenedoresHabilitados", false);
          this.getView().byId("btScan2").setEnabled(true);
          // 🔒 Marcar que ya se confirmó la asignación
          localStorage.setItem("asignacionConfirmada", "true");
          this.getView().byId("btConfirmarContenedores").setEnabled(false);

          var ctx = this;
          var oModel = this.getView().getModel();
          var aFullData = oModel.getProperty("/tableData");

          // Guardar en IndexedDB
          this.guardarEnIndexedDB(aFullData)
            .then(() => {
              MessageToast.show("Datos guardados correctamente en IndexedDB");

              // Actualizar el backend
              Promise.all(
                aFullData.map((item) => {
                  return this.actualizarBackend(
                    item.id,
                    item.contenedor,
                    item.display
                  );
                })
              )
                .then(() => {
                  MessageToast.show(
                    "Datos actualizados correctamente en el backend"
                  );
                  ctx.getView().byId("btScan2").setEnabled(true);
                })
                .catch((error) => {
                  MessageBox.error("Error al actualizar el backend: " + error);
                });
            })
            .catch((error) => {
              MessageBox.error("Error al guardar en IndexedDB: " + error);
            });
        },

        guardarEnIndexedDB: function (aData) {
          return new Promise((resolve, reject) => {
            let request = indexedDB.open("ventilado", 5);
            request.onerror = function (event) {
              reject("Error al abrir la base de datos");
            };

            request.onsuccess = function (event) {
              let db = event.target.result;
              let transaction = db.transaction(["ventilado"], "readwrite");
              let objectStore = transaction.objectStore("ventilado");

              aData.forEach(function (item) {
                let index = objectStore.index("LugarPDisp");
                let getRequest = index.getAll(item.Ruta);

                getRequest.onsuccess = function () {
                  let records = getRequest.result;

                  records.forEach(function (record) {
                    record.contenedor = item.contenedor;
                    record.display = item.display;

                    // Mapear contenedor a Prodv
                    switch (item.contenedor) {
                      case "CUB":
                        record.Prodv = "CU";
                        break;
                      case "PALLET":
                        record.Prodv = "PA";
                        break;
                      case "ROLL":
                        record.Prodv = "RO";
                        break;
                      default:
                        record.Prodv = "";
                    }

                    // Mapear display a Prodr (ej: dsp-001 → 001)
                    if (item.display && item.display.startsWith("dsp-")) {
                      record.Prodr = item.display.slice(4);
                    } else {
                      record.Prodr = "";
                    }

                    objectStore.put(record);
                  });
                };
              });

              transaction.oncomplete = function () {
                resolve();
              };

              transaction.onerror = function (e) {
                reject("Error en la transaccion: " + e.target.error);
              };
            };
          });
        },

        obtenerYProcesarDatos: function () {
          ctx = this;
          return this.obtenerDatosDeIndexedDB()
            .then((datos) => {
              ctx.datosD = this.procesarDatos(datos);
              ctx.datosD2 = this.procesarDatos2(datos);
            })
            .catch((error) => {
              console.error("Error al obtener datos de IndexedDB:", error);
              throw error;
            });
        },

        obtenerDatosDeIndexedDB: function () {
          ctx = this;
          return new Promise((resolve, reject) => {
            let request = indexedDB.open("ventilado", 5);
            request.onerror = (event) => {
              console.log("Error al abrir la base de datos:", event);
              reject("Error al abrir la base de datos");
            };
            request.onsuccess = (event) => {
              let db = event.target.result;
              ctx._dbConnections.push(db);
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
          datos.sort(function (a, b) {
            if (a.Ruta < b.Ruta) return -1;
            if (a.Ruta > b.Ruta) return 1;
            return 0;
          });

          let resultado = {};
          datos.forEach((registro) => {
            let ruta = registro.LugarPDisp;
            let cantidad = registro.CantidadEntrega;
            let sCantEscaneada = registro.CantEscaneada;
            // 🔄 Mapear Prodv a contenedor
            const contenedorMap = {
              CU: "CUB",
              PA: "PALLET",
              RO: "ROLL",
            };

            // 🔄 Mapear Prodr a display
            const displayFormatted = registro.Prodr
              ? "dsp-" + ("000" + registro.Prodr).slice(-3)
              : "";

            if (!resultado[ruta]) {
              resultado[ruta] = {
                Ruta: ruta,
                TOT: 0,
                SCAN: 0,
                FALTA: 0,
                TRANSPORTE: registro.Transporte,
                ENTREGA: registro.Entrega,
                KILO: 0,
                M3: 0,
                CLIENTE: registro.Destinatario,
                contenedor: contenedorMap[registro.Prodv] || "",
                display: registro.Prodr || "",
                id: registro.Id,
              };
            } else {
              // ⛔ Si viene contenedor y antes estaba vacío → actualizar
              if (registro.Prodv && resultado[ruta].contenedor === "") {
                resultado[ruta].contenedor =
                  contenedorMap[registro.Prodv] || "";
              }

              // ⛔ Si viene display y antes estaba vacío → actualizar
              if (registro.Prodr && resultado[ruta].display === "") {
                resultado[ruta].display = displayFormatted;
              }
            }

            resultado[ruta]["TOT"] += cantidad;
            resultado[ruta]["SCAN"] += Number(sCantEscaneada) || 0;
            resultado[ruta]["FALTA"] =
              resultado[ruta]["TOT"] - resultado[ruta]["SCAN"];
            resultado[ruta]["KILO"] = (
              parseFloat(resultado[ruta]["KILO"]) +
              (parseFloat(registro.Kgbrv) || 0)
            ).toFixed(1);
            resultado[ruta]["M3"] = (
              parseFloat(resultado[ruta]["M3"]) +
              (parseFloat(registro.M3v) || 0)
            ).toFixed(3);
            resultado[ruta]["CubTEO"] = Math.ceil(
              resultado[ruta]["M3"] / (0.7 * 0.077)
            );
            resultado[ruta]["id"] = registro.Id;
          });

          let arrayResultado = Object.keys(resultado).map(
            (ruta) => resultado[ruta]
          );

          return arrayResultado;
        },

        procesarDatos2: function (datos) {
          datos.sort(function (a, b) {
            if (a.CodigoInterno < b.CodigoInterno) return -1;
            if (a.CodigoInterno > b.CodigoInterno) return 1;
            return 0;
          });

          let resultado = {};
          datos.forEach((registro) => {
            let CI = registro.CodigoInterno;
            let cantidad = registro.CantidadEntrega;
            let sCantEscaneada = registro.CantEscaneada;

            if (!resultado[CI]) {
              resultado[CI] = {
                CI: CI,
                TOT: 0,
                SCAN: 0,
                FALTA: 0,
                TRANSPORTE: registro.Transporte,
                ENTREGA: registro.Entrega,
                DESCRIPCION: registro.Descricion,
              };
            }

            resultado[CI]["TOT"] += cantidad;
            resultado[CI]["SCAN"] += Number(sCantEscaneada);
            resultado[CI]["FALTA"] =
              resultado[CI]["TOT"] - resultado[CI]["SCAN"];
          });

          return Object.keys(resultado).map((key) => resultado[key]);
        },

        onExit: function () {
          this.closeAllDbConnections();
        },

        closeAllDbConnections: function () {
          this._dbConnections.forEach((db) => {
            db.close();
          });
          this._dbConnections = [];
        },

        _handleUnload: function () {
          this.closeAllDbConnections();
        },

        onNavToScan: function () {
          //Actualizar

          /*    var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
         oRouter.navTo("Scan"); */
          const oModel = this.getView().getModel();
          const aData = oModel.getProperty("/tableData");

          // Cantidad de registros/renglones
          const cantidadRegistros = aData.length;

          // Totalizar columnas
          const totalKilo = aData.reduce(
            (sum, item) => sum + (parseFloat(item.KILO) || 0),
            0
          );
          const totalM3 = aData.reduce(
            (sum, item) => sum + (parseFloat(item.M3) || 0),
            0
          );
          const totalTot = aData.reduce(
            (sum, item) => sum + (item.TOT || 0),
            0
          );


          const conteoContenedores = aData.reduce(
            (acc, item) => {
              if (item.contenedor === "CUB") acc.CUB++;
              else if (item.contenedor === "ROLL") acc.ROLL++;
              else if (item.contenedor === "PALLET") acc.PALLET++;
              return acc;
            },
            { CUB: 0, ROLL: 0, PALLET: 0 }
          );

          // Ejemplo: mostrar en consola
          console.log("CUB:", conteoContenedores.CUB);
          console.log("ROLL:", conteoContenedores.ROLL);
          console.log("PALLET:", conteoContenedores.PALLET);

          // Guardar en localStorage
          localStorage.setItem("avanceCantidadRegistros", cantidadRegistros);
          localStorage.setItem("avanceTotalKilo", totalKilo.toString());
          localStorage.setItem("avanceTotalM3", totalM3.toString());
          localStorage.setItem("avanceTotalTot", totalTot);

          localStorage.setItem("conteoCUB", conteoContenedores.CUB);
          localStorage.setItem("conteoROLL", conteoContenedores.ROLL);
          localStorage.setItem("conteoPALLET", conteoContenedores.PALLET);
          this.onConfirmarContenedores();
          // Asegurar que contenedor y display estén guardados
          this.guardarEnIndexedDB(aData)
            .then(() => {
              var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
              oRouter.navTo("Scan");
            })
            .catch((error) => {
              sap.m.MessageBox.error(
                "Error al guardar datos antes de escanear: " + error
              );
            });
        },

        mapearDisplayParaBackend: function (display) {
          if (display.startsWith("dsp-")) {
            return display.slice(4); // Extraer solo los números (ejemplo: "dsp-001" → "001")
          }
          return ""; // Valor predeterminado si no tiene el formato esperado
        },
        mapearContenedorParaBackend: function (contenedor) {
          switch (contenedor) {
            case "CUB":
              return "CU";
            case "ROLL":
              return "RO";
            case "PALLET":
              return "PA";
            default:
              return ""; // Valor predeterminado si no coincide
          }
        },

        actualizarBackend: function (id, contenedor, display) {
          var sPRODV = this.mapearContenedorParaBackend(contenedor);
          var sPRODR = this.mapearDisplayParaBackend(display);

          var oDatos = {
            Id: id,
            Prodv: sPRODV,
            Prodr: sPRODR,
          };

          this.oActualizarBackEnd(oDatos);
          return Promise.resolve(); // para que el flujo `Promise.all` siga funcionando
        },
        crud: function (sMetodo, datos, successCallback, errorCallback) {
          var oModel = new sap.ui.model.odata.v2.ODataModel(
            "/sap/opu/odata/sap/ZVENTILADO_SRV/",
            {
              useBatch: false,
              defaultBindingMode: "TwoWay",
              deferredGroups: ["batchGroup1"],
            }
          );
          var sPath = "/ventiladoSet(" + datos.Id + ")";

          oModel.update(sPath, datos, {
            success: function () {
              console.log("Backend actualizado con éxito (Scan2 style).");
              if (successCallback) successCallback();
            },
            error: function (oError) {
              console.error(
                "Error al actualizar backend (Scan2 style):",
                oError
              );
              if (errorCallback) errorCallback(oError);
            },
          });
        },
        oActualizarBackEnd: function (datos) {
          this.crud("ACTUALIZAR", datos);
        },

        // ✅ Nueva función para validar si se excede el límite de displays
        excedioLimiteDisplays: function (aData) {
          const totalEspacios = aData.reduce((acc, item) => {
            switch (item.contenedor) {
              case "CUB":
                return acc + 1;
              case "ROLL":
                return acc + 2;
              case "PALLET":
                return acc + 3;
              default:
                return acc;
            }
          }, 0);
          return totalEspacios > 30;
        },

        /* asignarContenedoresYDisplays: function (
          aData,
          limite1,
          limite2,
          usarRoll,
          respetarContenedorManual,
          skipSort
        ) {
          const indisponibles =
            this.getView().getModel().getProperty("/displaysNoDisponibles") ||
            [];
          // ✅ Detectar si ya hay contenedor y display asignado en al menos un registro

          aData.forEach((item) => {
            if (!respetarContenedorManual || !item.contenedor) {
              if (item.CubTEO <= limite1) {
                item.contenedor = "CUB";
              } else if (item.CubTEO > limite2 || !usarRoll) {
                item.contenedor = "PALLET";
              } else {
                item.contenedor = "ROLL";
              }
            }
          });

          // Ordenar si se requiere
          if (!skipSort) {
            const tipoOrden = { CUB: 1, PALLET: 2, ROLL: 3 };
            aData.sort((a, b) => {
              if (tipoOrden[a.contenedor] !== tipoOrden[b.contenedor]) {
                return tipoOrden[a.contenedor] - tipoOrden[b.contenedor];
              }
              return parseInt(a.Ruta) - parseInt(b.Ruta);
            });
          }

          // Asignación de displays
          let posicion = 1;
          const posicionesPorModulo = 6;

          aData.forEach((item) => {
            const espacios =
              item.contenedor === "CUB"
                ? 1
                : item.contenedor === "ROLL"
                  ? 2
                  : 3;

            let displayAsignado = null;

            while (!displayAsignado) {
              let moduloInicio = Math.ceil(posicion / posicionesPorModulo);
              let moduloFin = Math.ceil(
                (posicion + espacios - 1) / posicionesPorModulo
              );

              // Asegura que no se cruce de módulo
              if (moduloInicio === moduloFin) {
                // Buscar el primer display disponible dentro del bloque
                for (let i = 0; i < espacios; i++) {
                  const candidato = "dsp-" + ("000" + (posicion + i)).slice(-3);
                  if (!indisponibles.includes(candidato)) {
                    displayAsignado = candidato;
                    break;
                  }
                }
              }

              // Si no se asignó, seguir buscando
              if (!displayAsignado) {
                posicion++;
              }
            }

            item.display = displayAsignado;
            posicion += espacios;
          });

          return aData;
        }, */
        asignarContenedoresYDisplays: function (
          aData,
          limite1,
          limite2,
          usarRoll,
          respetarContenedorManual,
          skipSort
        ) {
          const indisponibles =
            this.getView().getModel().getProperty("/displaysNoDisponibles") || [];

          // Determinar contenedor si hace falta
          aData.forEach((item) => {
            if (!respetarContenedorManual || !item.contenedor) {
              if (item.CubTEO <= limite1) {
                item.contenedor = "CUB";
              } else if (item.CubTEO > limite2 || !usarRoll) {
                item.contenedor = "PALLET";
              } else {
                item.contenedor = "ROLL";
              }
            }
          });

          // Ordenar si corresponde
          if (!skipSort) {
            const tipoOrden = { CUB: 1, PALLET: 2, ROLL: 3 };
            aData.sort((a, b) => {
              if (tipoOrden[a.contenedor] !== tipoOrden[b.contenedor]) {
                return tipoOrden[a.contenedor] - tipoOrden[b.contenedor];
              }
              return parseInt(a.Ruta) - parseInt(b.Ruta);
            });
          }

          // Helpers
          const posicionesPorModulo = 6;
          const alineadoPallet = (p) => ((p - 1) % 3) === 0; // 1,4,7,10…
          const mismoModulo = (ini, fin) =>
            Math.ceil(ini / posicionesPorModulo) === Math.ceil(fin / posicionesPorModulo);

          let posicion = 1;

          // Asignación de displays
          aData.forEach((item) => {
            const espacios =
              item.contenedor === "CUB" ? 1 :
                item.contenedor === "ROLL" ? 2 : 3;

            let displayAsignado = null;

            if (item.contenedor === "PALLET") {
              // Forzar alineación a 1,4,7,10…
              while (!alineadoPallet(posicion)) {
                posicion++;
              }
            }

            while (!displayAsignado) {
              const fin = posicion + espacios - 1;

              if (mismoModulo(posicion, fin)) {
                // Bloque de candidatos
                const bloque = Array.from({ length: espacios }, (_, i) =>
                  "dsp-" + ("000" + (posicion + i)).slice(-3)
                );
                const bloqueLibre = bloque.every((d) => !indisponibles.includes(d));

                if (bloqueLibre) {
                  displayAsignado = bloque[0];
                  posicion += espacios;

                  // Re-alinear si es pallet
                  if (item.contenedor === "PALLET" && !alineadoPallet(posicion)) {
                    posicion += (3 - ((posicion - 1) % 3));
                  }
                } else {
                  // avanzar (1 en CUB/ROLL, 3 en PALLET)
                  posicion += (item.contenedor === "PALLET" ? 3 : 1);
                  if (item.contenedor === "PALLET" && !alineadoPallet(posicion)) {
                    posicion += (3 - ((posicion - 1) % 3));
                  }
                }
              } else {
                // saltar al siguiente módulo
                posicion = Math.ceil(posicion / posicionesPorModulo) * posicionesPorModulo + 1;
                if (item.contenedor === "PALLET" && !alineadoPallet(posicion)) {
                  posicion += (3 - ((posicion - 1) % 3));
                }
              }
            }

            item.display = displayAsignado;
          });

          return aData;
        },


        onAdminUnlock: function () {
          const oView = this.getView();

          const input = new sap.m.Input({
            type: "Password",
            placeholder: "Ingrese clave",
          });

          // 🛡️ Evitar que el navegador autocomplete la contraseña
          input.addEventDelegate({
            onAfterRendering: function () {
              const domRef = input.getDomRef();
              if (domRef) {
                domRef.setAttribute("autocomplete", "new-password");
              }
            },
          });

          const dialog = new sap.m.Dialog({
            title: "Desbloquear asignacion",
            content: [input],
            beginButton: new sap.m.Button({
              text: "Aceptar",
              press: () => {
                const clave = input.getValue();
                if (clave === "12345") {
                  // 🔐 Cambiar por tu clave real si querés
                  localStorage.removeItem("asignacionConfirmada");

                  // ✅ Habilitar botón
                  oView.byId("btConfirmarContenedores").setEnabled(true);
                  oView.byId("btScan2").setEnabled(false);

                  // ✅ Habilitar modificación de contenedores
                  oView
                    .getModel()
                    .setProperty("/contenedoresHabilitados", true);

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
      }
    );
  }
);
