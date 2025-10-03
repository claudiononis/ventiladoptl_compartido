sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/odata/v2/ODataModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator", // Importar BusyIndicator
  ],
  function (
    Controller,
    MessageToast,
    JSONModel,
    ODataModel,
    Filter,
    FilterOperator,
    MessageBox,
    BusyIndicator
  ) {
    "use strict";
    var ctx = this; // Variable eglobal en el controlador para guardar el contexto
    var sTransporte;
    var sPuesto; //Estacion
    var sReparto;
    var sPtoPlanif;
    var sUsuario;
    var sFecha;
    var datosD = [];
    return Controller.extend(
      "ventilado.ventiladoptl.controller.Desconsolidado",
      {
        onInit: function () {
          this._dbConnections = []; // Array para almacenar conexiones abiertas
          // Obtener el router y attachRouteMatched
          var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
          oRouter
            .getRoute("Desconsolidado")
            .attachMatched(this.onRouteMatched, this);

          var oModel = new sap.ui.model.json.JSONModel();
          oModel.setData({
            tableData: [],
            totalesPorRuta: [],
          });

          this.getView().setModel(oModel);
          // Manejar eventos de navegación - para atender cuandose va a salir de lapagina
          window.addEventListener(
            "beforeunload",
            this._handleUnload.bind(this)
          );
          window.addEventListener("popstate", this._handleUnload.bind(this));

          // Ejecutar acciones iniciales
          this.ejecutarAcciones();
        },

        onRouteMatched: async function () {
          // Ejecutar acciones cada vez que la ruta es navegada
          this.ejecutarAcciones();
        },

        ejecutarAcciones: async function () {
          // Lerr datos locales
          sPuesto = localStorage.getItem("sPuesto");
          sReparto = localStorage.getItem("sReparto");
          sPtoPlanif = localStorage.getItem("sPtoPlanif");
          sUsuario = localStorage.getItem("sPreparador");
          var oModel = new sap.ui.model.json.JSONModel();
          var completo = 0;
          this.getView().setModel(oModel);
          await this.obtenerYProcesarDatos();

          // Objeto para almacenar los datos agrupados por código interno y descripción
          var datosAgrupados = {};
          // Objeto para almacenar los totales por ruta
          var totalesPorRuta = {};
          // Iterar sobre los datos y agrupar por código interno y descripción

          datosD.forEach(function (item) {
            var codInterno = item.CodInterno;
            var descripcion = item.Descripcion;
            var ruta = item.Ruta;
            var cantidadEscaneada = item.CantidadEscaneada;
            var entrega = item.Entrega;
            var transporte = item.Transporte;
            var CantidadEntrega = item.CantidadEntrega;

            // Si el código interno no existe en el objeto de datos agrupados, crear un nuevo objeto para él
            if (!datosAgrupados[codInterno]) {
              datosAgrupados[codInterno] = {
                CodInterno: codInterno,
                Descripcion: descripcion,
                Transporte: transporte,
                Entrega: entrega,
                CantidadEntrega: CantidadEntrega,
                Tot: 0,
                scan: 0,
                Falta: 0,
              };
            }
            // Acumular el total por código interno
            datosAgrupados[codInterno].Tot += CantidadEntrega;
            datosAgrupados[codInterno].scan += cantidadEscaneada;
            datosAgrupados[codInterno].Falta =
              datosAgrupados[codInterno].Tot - datosAgrupados[codInterno].scan;
            //CantidadEntrega += CantidadEntrega
            // Agregar o actualizar la cantidad escaneada para la ruta correspondiente
            //   datosAgrupados[codInterno][ruta] = cantidadEscaneada;
            // Agregar o actualizar la cantidad escaneada y el color para la ruta correspondiente
            var color = "";
            var color2 = false;
            if (CantidadEntrega - cantidadEscaneada == 0)
              color = false; //'greenBackground';
            else {
              if (cantidadEscaneada == 0) {
                color = true; //'redBackground';
                color2 = false;
              } else {
                color2 = true;
                color = false;
              }
            }
            var cant = 0;
            if (cantidadEscaneada == 0) cant = CantidadEntrega;
            else cant = cantidadEscaneada;
            var cantF = CantidadEntrega - cantidadEscaneada;

            datosAgrupados[codInterno][ruta] = {
              cantidadEscaneada: cant, //cantidadEscaneada,
              cantFaltante: cantF,
              color: color,
              color2: color2,
            };

            // Agregar o actualizar los totales por ruta
            if (!totalesPorRuta[ruta]) {
              if (CantidadEntrega - cantidadEscaneada == 0)
                color = false; //'greenBackground';
              else color = true;
              totalesPorRuta[ruta] = {
                CantidadTotal: 0,
                Entrega: entrega,
                color: color,
              };
            }
            totalesPorRuta[ruta].CantidadTotal += cantidadEscaneada;
          });

          // Convertir el objeto de datos agrupados en un array
          var arrayDatosAgrupados = [];

          // Iterar sobre los datos agrupados y convertirlos en un array
          for (var cod in datosAgrupados) {
            arrayDatosAgrupados.push(datosAgrupados[cod]);
          }

          // Mostrar el resultado final en la consola (solo para demostración)
          console.log(arrayDatosAgrupados);
          var arrayTotalesPorRuta = [];
          for (var ruta in totalesPorRuta) {
            arrayTotalesPorRuta.push({
              Ruta: ruta,
              CantidadTotal: totalesPorRuta[ruta].CantidadTotal,
              Entrega: totalesPorRuta[ruta].Entrega,
              color: totalesPorRuta[ruta].color,
            });
          }

          // Crear una lista de todas las posibles rutas (01 a 30)
          var todasLasRutas = [];
          for (var i = 1; i <= 30; i++) {
            todasLasRutas.push(String(i).padStart(2, "0"));
          }

          // Agregar rutas vacías si no existen en arrayTotalesPorRuta
          todasLasRutas.forEach(function (ruta) {
            if (
              !arrayTotalesPorRuta.some(function (item) {
                return item.Ruta === ruta;
              })
            ) {
              arrayTotalesPorRuta.push({
                Ruta: ruta,
                CantidadTotal: 0,
                Entrega: null,
              });
            }
          });

          // Ordenar arrayTotalesPorRuta por Ruta ascendente
          arrayTotalesPorRuta.sort(function (a, b) {
            if (a.Ruta < b.Ruta) {
              return -1;
            }
            if (a.Ruta > b.Ruta) {
              return 1;
            }
            return 0;
          });

          // Mostrar el array ordenado en la consola (solo para demostración)
          console.log(arrayTotalesPorRuta);
          // Calcular la suma de `cantFaltante` y asignar a `completo` si es mayor que 0
          completo = arrayDatosAgrupados.reduce((sum, item) => {
            return (
              sum +
              Object.values(item).reduce((innerSum, rutaData) => {
                return innerSum + (rutaData.cantFaltante || 0);
              }, 0)
            );
          }, 0);
          if (completo == 0) {
            this.getView().byId("bDesafectar").setEnabled(false);
          }

          // Crear un nuevo modelo JSON con ambos arrays
          // var oModel = new sap.ui.model.json.JSONModel();
          var oModel = this.getView().getModel();
          oModel.setData({
            tableData: arrayDatosAgrupados,
            totalesPorRuta: arrayTotalesPorRuta,
          });

          // Asignar el modelo a la vista
          this.getView().setModel(oModel);
          // Manejar eventos de navegación
          window.addEventListener(
            "beforeunload",
            this._handleUnload.bind(this)
          );
          window.addEventListener("popstate", this._handleUnload.bind(this));
        },
        formatColorClass: function (colorValue) {
          return colorValue === 0 ? greenBackground : redBackground;
        },
        obtenerYProcesarDatos: async function () {
          try {
            let datos = await this.obtenerDatosDeIndexedDB();
            datosD = this.procesarDatos(datos);
          } catch (error) {
            console.log("Error:", error);
          }
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
          datos.sort(function (a, b) {
            if (a.CodInterno < b.CodInterno) {
              return -1;
            }
            if (a.CodInterno > b.CodInterno) {
              return 1;
            }
            return 0;
          });
          let resultado = {};
          datos.forEach((registro) => {
            resultado[registro.Id] = {
              Id: registro.Id,
              CodInterno: registro.CodigoInterno,
              Descripcion: registro.Descricion,
              CantidadEscaneada: registro.CantEscaneada,
              Ruta: String(registro.LugarPDisp).padStart(2, "0"),
              Transporte: registro.Transporte,
              Entrega: registro.Entrega,
              CantidadEntrega: registro.CantidadEntrega,
            };
          });

          // Convierte el objeto resultado en un array
          let arrayResultado = Object.keys(resultado).map(
            (ruta) => resultado[ruta]
          );

          return arrayResultado;
        },
        formatCantidadTotal: function (cantidadTotal) {
          return cantidadTotal === 0 ? "" : cantidadTotal;
        },

        formatRuta: function (cantidadTotal, ruta, entrega) {
          // return cantidadTotal === 0 ? "" : ruta;
          return !entrega ? "" : ruta;
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
        onNavToScan: function () {
          var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
          oRouter.navTo("Scan");
        },

        onCellClick: function (oEvent) {
          // Obtener la celda que fue clickeada
          var oClickedCell = oEvent.getSource();

          // Obtener la tabla
          var oTable = this.byId("idTbDesconsolidado");

          // Remover cualquier clase de columna seleccionada previamente
          oTable.$().find(".highlightColumn").removeClass("highlightColumn");

          // Aplicar la clase CSS solo a las celdas de la columna seleccionada
          var iClickedColumnIndex = oTable.indexOfColumn(
            oClickedCell.getParent()
          );
          oTable.getItems().forEach(function (oItem) {
            var oCell = oItem.getCells()[iClickedColumnIndex];
            oCell.addStyleClass("highlightColumn");
          });
        },

        onVerDesafectacionPress: function () {
          this.onExit();
          const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
          oRouter.navTo("Verdesafectacion");
        },
        onDesafectacionPress: function () {
          ctx = this;
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

          //
          var oModel = new ODataModel("/sap/opu/odata/sap/ZVENTILADO_SRV/");
          var aFilters = [];
          aFilters.push(
            new Filter(
              "Transporte",
              FilterOperator.EQ,
              localStorage.getItem("sReparto")
            )
          );
          var ctx = this;

          oModel.read("/zdesafectacionSet", {
            filters: aFilters,
            success: function (oData) {
              // Verificar si oData contiene registros
              if (oData.results && oData.results.length > 0) {
                // Si hay registros, ya se hizo la desafectacion
                MessageBox.warning(
                  " No se puede realizar la desafectacion!! ya fue realizada anteriormente",
                  {
                    actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                    onClose: function (oAction) {
                      if (oAction === MessageBox.Action.OK) {
                      }
                    },
                  }
                );
              } else {
                var dModel = new sap.ui.model.odata.v2.ODataModel(
                  "/sap/opu/odata/sap/ZVENTILADO_SRV/",
                  {
                    useBatch: false,
                    defaultBindingMode: "TwoWay",
                  }
                );
                // Crear evento de desafectacion en ZLOG_VENTILADOSet
                var sTransporte = ctx
                  .getView()
                  .getModel()
                  .getProperty("/tableData/0/Transporte");
                if (typeof sTransporte === "string") {
                  sTransporte = sTransporte.trim().padStart(10, "0");
                } else {
                  sTransporte = String(sTransporte).padStart(10, "0");
                }
                var sTipoLog = "DESAFECTAR";
                var now = new Date();
                var sHoraActual = now.toTimeString().slice(0, 8); // "HH:MM:SS"
                function toODataTime(timeStr) {
                  var parts = timeStr.split(":");
                  return (
                    "PT" + parts[0] + "H" + parts[1] + "M" + parts[2] + "S"
                  );
                }
                var sODataFechaInicio = "/Date(" + now.getTime() + ")/";
                var sODataHoraInicio = toODataTime(sHoraActual);
                var estacionValue =
                  localStorage.getItem("estacion") ||
                  localStorage.getItem("sPuesto") ||
                  "";
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
                  Cliente: "",
                  Estacion: estacionValue,
                  Entrega: entregaValue,
                  Centro: centroValue,
                  Preparador: preparadorValue,
                  Transporte: sTransporte,
                  CantAsignada: 0,
                  ConfirmadoEnRuta: "",
                };

                dModel.create("/zlog_ventiladoSet", oEntry, {
                  error: function (err) {
                    sap.m.MessageBox.error(
                      "Error al crear el evento de desafectación."
                    );
                  },
                });

                // Si no hay registros, no se hizo desafectacion
                console.log("No hay registros en el OData."); //No serealizo la  desafectacion
                MessageBox.warning(
                  "ATENCION! Se van a desafectar en SAP los materiales indicados para cada ENTREGA, confirma?",
                  {
                    actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                    onClose: function (oAction) {
                      if (oAction === MessageBox.Action.OK) {
                        // Codigo para la desafectacion
                        var oModel = ctx.getView().getModel();
                        var oModel = new sap.ui.model.odata.v2.ODataModel(
                          "/sap/opu/odata/sap/ZVENTILADO_SRV/",
                          {
                            useBatch: false,
                            defaultBindingMode: "TwoWay",
                            deferredGroups: ["batchGroup1"],
                          }
                        );
                        oModel.refreshMetadata();
                        BusyIndicator.show();
                        oModel.callFunction("/GenerarTransporte", {
                          // se llama a la function import
                          method: "GET",
                          urlParameters: {
                            transporte: "BI_" + sReparto, // pasa los parametros strings
                            pto_planificacion: "0000", //sPtoPlanificacion
                          },
                          success: function (oData) {
                            // Manejar éxito
                            // MessageToast.show("Se cargaron los datos para el ventilado");
                            // Procesar la respuesta aquí

                            var estado = oData.Ean;
                            // Aquí se puede  trabajar con los datos recibidos
                            console.log("Estado: ", estado);
                            BusyIndicator.hide(); // Ocultar
                            MessageToast.show(
                              "Se completo la Desafectacion de material"
                            );
                          },
                          error: function (oError) {
                            // Manejar error
                            var sErrorMessage = "";
                            try {
                              var oErrorResponse = JSON.parse(
                                oError.responseText
                              );
                              sErrorMessage =
                                oErrorResponse.error.message.value;
                            } catch (e) {
                              sErrorMessage =
                                "Error desconocido,  revise conexion de Internet y VPN";
                            }
                            BusyIndicator.hide(); // Ocultar
                            MessageToast.show(sErrorMessage);
                          },
                          timeout: 10000, // Establecer un tiempo de espera de 10 segundos
                        });
                      }
                    },
                  }
                );
              }
            },
            error: function (oError) {
              console.error("Error al leer datos del servicio OData:", oError);
              reject(oError); // Si hay un error, rechazamos la promesa
            },
          });

          //   }
        },

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
                MessageToast.show(
                  "Todos los registros se han creado con exito."
                );
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
      }
    );
  }
);
