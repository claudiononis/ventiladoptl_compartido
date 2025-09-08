sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/odata/v2/ODataModel"
], function (Controller, Filter, FilterOperator, JSONModel, ODataModel) {
    "use strict";

    return Controller.extend("ventilado.ventiladoptl.controller.Logtransporte", {
        onInit: function () {
            this.getView().setModel(new JSONModel({ tableData: [] }));
        },
        onTransporteLinkPress: function (oEvent) {
            // Puedes obtener el valor si lo necesitas:
            var oContext = oEvent.getSource().getBindingContext();
            var sTransporte = oEvent.getSource().getText();
            var sOperador = oContext.getProperty("Operador");
            var sEstacion = oContext.getProperty("Estacion");

            // Guarda los valores en localStorage
            localStorage.setItem("transporte", sTransporte);
            localStorage.setItem("operador", sOperador);
            localStorage.setItem("estacion", sEstacion);
            localStorage.setItem("origen", "logtransporte");
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("RouteView1"); // Puedes pasar parámetros si lo necesitas
        },
        /* onSearch: function () {
            var oView = this.getView();
            // var oODataModel = this.getOwnerComponent().getModel(); // OData v2 model definido en manifest.json
            var oODataModel = new ODataModel("/sap/opu/odata/sap/ZVENTILADO_SRV/");
            var sFrom = oView.byId("dpFrom").getValue();
            var sTo = oView.byId("dpTo").getValue();
            var sTransporte = oView.byId("inpTransporte").getValue().padStart(10, "0");

            var aFilters = [];

            if (sFrom && sTo) {
                var oFromDate = new Date(sFrom);
                var oToDate = new Date(sTo);
                aFilters.push(new Filter("Fechainicio", FilterOperator.BT, sFrom, sTo));
            }
            if (sTransporte) {
                aFilters.push(new Filter("Transporte", FilterOperator.EQ, sTransporte));
            }

            var that = this;
            oODataModel.read("/ZVENTILADO_KPISet", {
                filters: aFilters,
                success: function (oData) {
                    // cargo los resultados en el JSONModel de la vista
                    that.getView().getModel().setProperty("/tableData", oData.results);
                },
                error: function (oError) {
                    sap.m.MessageToast.show("Error al leer datos");
                }
            });
        }, */
        onSearch: function () {
            var oView = this.getView();
            // Usá el model del componente si ya está configurado en manifest
            var oODataModel = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/sap/ZVENTILADO_SRV/");

            // Fechas: con valueFormat="yyyy-MM-dd" en la view, getValue() ya devuelve eso.
            var sFrom = oView.byId("dpFrom").getValue(); // "yyyy-MM-dd" o ""
            var sTo = oView.byId("dpTo").getValue();   // "yyyy-MM-dd" o ""

            // Transporte: NO pad si está vacío
            var sTransporteRaw = oView.byId("inpTransporte").getValue(); // "" o "123"
            var sTransporte = sTransporteRaw ? sTransporteRaw.padStart(10, "0") : "";

            // Tipo (Radio): PTL | Tradicional | Ambos
            var iTipoIdx = this.byId("rbTipo").getSelectedIndex(); // 0,1,2
            var aTipos = ["PTL", "TRADICIONAL", "Ambos"];
            var sTipo = aTipos[iTipoIdx] || "Ambos";

            var aFilters = [];

            // Fechainicio
            if (sFrom && sTo) {
                aFilters.push(new sap.ui.model.Filter("Fechainicio", sap.ui.model.FilterOperator.BT, sFrom, sTo));
            } else if (sFrom) {
                aFilters.push(new sap.ui.model.Filter("Fechainicio", sap.ui.model.FilterOperator.GE, sFrom));
            } else if (sTo) {
                aFilters.push(new sap.ui.model.Filter("Fechainicio", sap.ui.model.FilterOperator.LE, sTo));
            }

            // Transporte
            if (sTransporteRaw) { // ojo: usamos el RAW para decidir si filtrar
                aFilters.push(new sap.ui.model.Filter("Transporte", sap.ui.model.FilterOperator.EQ, sTransporte));
            }

            // Tipo (siempre; el backend ya interpreta "Ambos")
            aFilters.push(new sap.ui.model.Filter("Campoadicional1", sap.ui.model.FilterOperator.EQ, sTipo));

            var that = this;
            oODataModel.read("/ZVENTILADO_KPISet", {
                filters: aFilters,
                success: function (oData) {
                    that.getView().getModel().setProperty("/tableData", oData.results || []);
                },
                error: function () {
                    sap.m.MessageToast.show("Error al leer datos");
                }
            });
        }


    });
});