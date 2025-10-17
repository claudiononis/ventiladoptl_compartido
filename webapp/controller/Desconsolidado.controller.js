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
            var m3teo = item.M3teo;
            var cantidadEscaneada = item.CantidadEscaneada;
            var entrega = item.Entrega;
            var transporte = item.Transporte;
            var CantidadEntrega = item.CantidadEntrega;

            var clave = codInterno + "|" + m3teo;
            // Si el código interno no existe en el objeto de datos agrupados, crear un nuevo objeto para él
            // if (!datosAgrupados[codInterno]) {
            //   datosAgrupados[codInterno] = {
            if (!datosAgrupados[clave]) {
              datosAgrupados[clave] = {
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
            /*  datosAgrupados[codInterno].Tot += CantidadEntrega;
            datosAgrupados[codInterno].scan += cantidadEscaneada;
            datosAgrupados[codInterno].Falta =
            datosAgrupados[codInterno].Tot - datosAgrupados[codInterno].scan; */
            // Acumulados por par (CodInterno, M3teo)
            datosAgrupados[clave].Tot += CantidadEntrega;
            datosAgrupados[clave].scan += cantidadEscaneada;
            datosAgrupados[clave].Falta =
              datosAgrupados[clave].Tot - datosAgrupados[clave].scan;
            datosAgrupados[clave].Tot - datosAgrupados[clave].scan;

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

            // datosAgrupados[codInterno][ruta] = {
            datosAgrupados[clave][ruta] = {
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
              M3teo: registro.M3teo,
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
                  Entrega: "",
                  Centro: entregaValue,
                  Preparador: preparadorValue,
                  Transporte: sTransporte,
                  CantAsignada: 0,
                  ConfirmadoEnRuta: "",
                };

                dModel.create("/zlog_ventiladoSet", oEntry, {
                  success: function (data) {
                    // Actualizar cronómetro después del create exitoso de DESAFECTAR
                    ctx._validarYActualizarCronometro();
                  },
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
                        // Realizar sincronización antes de la desafectación
                        ctx._sincronizarAntesDeDesafectar();
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

        // Función para validar y actualizar cronómetro - copiada de View1.controller.js
        _validarYActualizarCronometro: function () {
          // Obtener horainicio del localStorage
          var sHoraInicioOData = localStorage.getItem("HoraInicio");

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
            // Calcular tiempo transcurrido desde la hora de inicio
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

            // Actualizar el cronómetro y DETENERLO completamente
            var oClockModel = this.getOwnerComponent().getModel("clock");

            // Detener TODOS los timers posibles del cronómetro
            var oComponent = this.getOwnerComponent();

            // Intentar múltiples formas de detener el timer - INCLUIR _clockInterval que es el que realmente usa Component.js
            if (oComponent._clockInterval) {
              clearInterval(oComponent._clockInterval);
              oComponent._clockInterval = null;
            }

            if (oComponent._clockTimer) {
              clearInterval(oComponent._clockTimer);
              oComponent._clockTimer = null;
            }

            if (oComponent.clockTimer) {
              clearInterval(oComponent.clockTimer);
              oComponent.clockTimer = null;
            }

            if (oComponent._timerInterval) {
              clearInterval(oComponent._timerInterval);
              oComponent._timerInterval = null;
            }

            // Forzar isRunning a false en el modelo
            oClockModel.setProperty("/time", formattedTime);
            oClockModel.setProperty("/elapsedSeconds", diferenciaEnSegundos);
            oClockModel.setProperty("/isRunning", false); // Siempre detenido

            // Forzar el refresh del modelo
            oClockModel.refresh();

            // Guardar en localStorage
            localStorage.setItem(
              "clockData",
              JSON.stringify(oClockModel.getData())
            );
          }
        },

        // Función para sincronizar datos antes de realizar la desafectación
        _sincronizarAntesDeDesafectar: async function () {
          var ctx = this;

          try {
            // Mostrar indicador de carga durante la sincronización
            BusyIndicator.show();

            // Realizar la sincronización
            await ctx._sincronizarBaseDatos();

            // Si la sincronización es exitosa, proceder con la desafectación
            BusyIndicator.hide();
            await ctx._realizarDesafectacion();
          } catch (error) {
            // Si hay error en la sincronización, mostrar popup y no permitir continuar
            BusyIndicator.hide();

            MessageBox.error(
              "No hay conexión con el servidor. No se puede realizar la sincronización de datos. " +
                "Verifique su conexión a internet y VPN, e intente nuevamente.",
              {
                title: "Error de Conectividad",
                actions: [MessageBox.Action.OK],
              }
            );
          }
        },

        _realizarDesafectacion: async function () {
          var ctx = this;
          try {
            await ctx._sincronizarBaseDatos();
            await ctx.obtenerYProcesarDatos();

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
              method: "GET",
              urlParameters: {
                transporte: "BI_" + sReparto,
                pto_planificacion: "0000",
              },
              success: function (oData) {
                var estado = oData.Ean;
                BusyIndicator.hide();
                MessageToast.show("Se completo la desafectacion de material");
              },
              error: function (oError) {
                // Manejar error
                var sErrorMessage = "";
                try {
                  var oErrorResponse = JSON.parse(oError.responseText);
                  sErrorMessage = oErrorResponse.error.message.value;
                } catch (e) {
                  sErrorMessage =
                    "Error desconocido, revise conexion de internet y VPN";
                }
                BusyIndicator.hide();
                MessageToast.show(sErrorMessage);
              },
              timeout: 10000, // Establecer un tiempo de espera de 10 segundos
            });
          } catch (error) {
            BusyIndicator.hide();
            MessageToast.show("Error al sincronizar datos: " + error.message);
            console.error("Error en sincronización:", error);
          }
        },

        // Función para sincronizar base de datos local con OData
        _sincronizarBaseDatos: function () {
          var ctx = this;
          return new Promise((resolve, reject) => {
            var oODataModel = new sap.ui.model.odata.v2.ODataModel(
              "/sap/opu/odata/sap/ZVENTILADO_SRV/"
            );

            // Filtros para obtener datos del transporte actual
            var aFilters = [
              new Filter("Transporte", FilterOperator.EQ, sReparto),
            ];

            // Leer datos del OData
            oODataModel.read("/ventiladoSet", {
              filters: aFilters,
              success: function (oData) {
                if (!oData.results || oData.results.length === 0) {
                  resolve();
                  return;
                }

                // Abrir base de datos local
                var request = indexedDB.open("ventilado", 5);

                request.onerror = function (event) {
                  reject(new Error("Error al abrir base de datos local"));
                };

                request.onsuccess = function (event) {
                  var db = event.target.result;
                  ctx._dbConnections.push(db);

                  // Obtener datos locales primero
                  var transaction = db.transaction(["ventilado"], "readonly");
                  var objectStore = transaction.objectStore("ventilado");
                  var localData = [];

                  objectStore.openCursor().onsuccess = function (event) {
                    var cursor = event.target.result;
                    if (cursor) {
                      localData.push(cursor.value);
                      cursor.continue();
                    } else {
                      // Comparar y actualizar datos
                      ctx._compararYActualizarDatos(
                        db,
                        localData,
                        oData.results,
                        resolve,
                        reject
                      );
                    }
                  };

                  objectStore.openCursor().onerror = function (event) {
                    reject(new Error("Error al leer datos locales"));
                  };
                };
              },
              error: function (oError) {
                reject(new Error("Error al leer datos del backend"));
              },
            });
          });
        },

        // Función para comparar y actualizar datos desde base local hacia OData
        _compararYActualizarDatos: function (
          db,
          localData,
          odataData,
          resolve,
          reject
        ) {
          var ctx = this;
          var registrosParaActualizarEnOData = [];

          // Crear un mapa de datos OData por ID para búsqueda rápida
          var odataDataMap = {};
          odataData.forEach(function (item) {
            odataDataMap[item.Id] = item;
          });

          // Comparar cada registro local con el OData
          localData.forEach(function (localItem) {
            var odataItem = odataDataMap[localItem.Id];
            if (odataItem) {
              // Verificar si hay diferencias en campos importantes
              var camposAComparar = [
                "CantEscaneada",
                "Estado",
                "AdicChar2",
                "AdicDec2",
                "Preparador",
                "AdicDec1",
                "Kgbrr",
                "M3r",
              ];

              var hayDiferencias = false;

              camposAComparar.forEach(function (campo) {
                if (localItem[campo] !== odataItem[campo]) {
                  hayDiferencias = true;
                }
              });

              if (hayDiferencias) {
                // Los datos locales son la fuente de verdad, actualizar OData
                registrosParaActualizarEnOData.push({
                  Id: localItem.Id,
                  Estado: localItem.Estado,
                  CantEscaneada: localItem.CantEscaneada,
                  AdicChar2: localItem.AdicChar2,
                  AdicDec2: localItem.AdicDec2,
                  Preparador: localItem.Preparador,
                  AdicDec1: localItem.AdicDec1,
                  Kgbrr: localItem.Kgbrr,
                  M3r: localItem.M3r,
                });
              }
            }
          });

          // Función para actualizar registros en OData
          if (registrosParaActualizarEnOData.length === 0) {
            resolve();
            return;
          }

          var oODataModel = new sap.ui.model.odata.v2.ODataModel(
            "/sap/opu/odata/sap/ZVENTILADO_SRV/",
            {
              useBatch: false,
              defaultBindingMode: "TwoWay",
            }
          );

          var actualizacionesCompletadas = 0;
          var hayErrores = false;

          registrosParaActualizarEnOData.forEach(function (registro) {
            var sPath = "/ventiladoSet(" + registro.Id + ")";
            oODataModel.update(sPath, registro, {
              success: function () {
                actualizacionesCompletadas++;
                if (
                  actualizacionesCompletadas ===
                    registrosParaActualizarEnOData.length &&
                  !hayErrores
                ) {
                  resolve();
                }
              },
              error: function (oError) {
                hayErrores = true;
                reject(new Error("Error al sincronizar datos con el servidor"));
              },
            });
          });
        },
        //******* Fin  Funciones para el CRUD  *******/
      }
    );
  }
);
