///////////////////////////////////////////////////////////////////////////
// Copyright � 2014 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
    'dijit/registry',
    'dojo/query',
    'dojo/dom-construct',
    'jimu/dijit/ImageChooser',
    'dojo/_base/declare',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/Editor',
    'jimu/BaseWidgetSetting',
    'jimu/dijit/SimpleTable',
    'jimu/LayerInfos/LayerInfos',
    'dijit/form/Button',
    'dijit/form/Select',
    'dijit/form/ValidationTextBox',
    'dijit/form/CheckBox',
    'jimu/dijit/Message',
    'jimu/dijit/LoadingShelter',
    'jimu/dijit/Filter',
    'jimu/dijit/Popup',
    'jimu/dijit/Message',
    'jimu/dijit/_FeaturelayerServiceChooserContent',
    'esri/request',
    'esri/symbols/jsonUtils',
    'dijit/TooltipDialog',
    'dijit/popup',
    'dojo/_base/lang',
    'dojo/DeferredList',
    'dojo/on',
    'dojox/gfx',
    'dojo/dom-class',
    'dojo/Deferred',
    'dojo/dom-style',
    'dojo/query',
    'dojo/_base/html',
    'dojo/_base/array',
    'dojo/sniff',
    './MySymbolPicker'
],
  function (
    registry,
    query,
    domConstruct,
    ImageChooser,
    declare,
    _WidgetsInTemplateMixin,
    Editor,
    BaseWidgetSetting,
    Table,
    LayerInfos,
    Button,
    Select,
    ValidationTextBox,
    CheckBox,
    Message,
    LoadingShelter,
    Filter,
    Popup,
    Message,
    _FeaturelayerServiceChooserContent,
    esriRequest,
    jsonUtils,
    TooltipDialog,
    dijitPopup,
    lang,
    DeferredList,
    on,
    gfx,
    domClass,
    Deferred,
    domStyle,
    query,
    html,
    array,
    has,
    SymbolPicker
    ) {
    return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
      baseClass: 'jimu-widget-511-setting',
      _layerInfos: null,
      _tableInfos: null,
      mpi: null,
      layer_options: [],
      refreshLayers: [],
      geomTypeResults: [],
      hasUpdatedInfo: false,

      // 2) Add cluster SVG or other sumbol props beside the icon in the settings table
      // 3) Finish the remove of the second download script button
      // 4) Label should reset or clear on selection changed for the drop down?


      postCreate: function () {
        this.inherited(arguments);
        this._getAllLayers();
        this.own(on(this.btnAddLayer, 'click', lang.hitch(this, this._addLayerRow)));
        this.own(on(this.layerTable, 'actions-edit', lang.hitch(this, this._pickSymbol)));
      },

      startup: function () {
        this.inherited(arguments);
      },

      _getAllLayers: function () {
        if (this.map.itemId) {
          LayerInfos.getInstance(this.map, this.map.itemInfo)
            .then(lang.hitch(this, function (operLayerInfos) {
              this.opLayers = operLayerInfos;
              this._setLayers();
              this.setConfig(this.config);
            }));
        }
      },

      _setLayers: function () {
        var options = [];
        for (var i = 0; i < this.opLayers._layerInfos.length; i++) {
          var OpLyr = this.opLayers._layerInfos[i];

          if (OpLyr.newSubLayers.length > 0) {
            this._recurseOpLayers(OpLyr.newSubLayers, options);
          } else if (OpLyr.featureCollection) {
            if (OpLyr.layers.length > 1) {
              this._recurseOpLayers(OpLyr.layers, options);
            }
          } else if (OpLyr.originOperLayer) {
            var OpLyr2 = OpLyr.originOperLayer;
            if (OpLyr2.featureCollection) {
              if (OpLyr2.featureCollection.layers.length > 1) {
                this._recurseOpLayers(OpLyr2.featureCollection.layers, options);
              } else {
                
                options.unshift({
                  label: OpLyr.title,
                  value: OpLyr.title,
                  url: undefined,
                  use: OpLyr.use,
                  imageData: OpLyr.imageData,
                  id: OpLyr.id,
                  geometryType: OpLyr2.featureCollection.layers[0].layerObject.geometryType,
                  type: OpLyr.type,
                  renderer: OpLyr2.featureCollection.layers[0].layerObject.renderer,
                  itemId: OpLyr2.itemId
                });
              }
            } else {

              if (typeof (OpLyr.layerObject.geometryType) === 'undefined') {
                this.setGeometryType(OpLyr.layerObject);
              }

              options.unshift({
                label: OpLyr.title,
                value: OpLyr.title,
                url: OpLyr.layerObject.url,
                use: OpLyr.use,
                imageData: OpLyr.imageData,
                id: OpLyr.id,
                type: OpLyr.type,
                renderer: OpLyr.layerObject.renderer,
                geometryType: OpLyr.layerObject.geometryType
              });
            }
          } else {
            //TODO determine and pass in geom type here
            // should I also do the layer type and any of the other type work that is needed
            // by the widget here so that can all be done up front
            // in addition to that...should I also just fire off the queries to the datasources at this time??
            //  if we did that then we could basically just pass the layer instances to the widget...update the props as they change 
            //  and further minimize the delay we see on panel load...need to think through this further
            if (typeof (OpLyr.layerObject.geometryType) === 'undefined') {
              this.setGeometryType(OpLyr.layerObject);
            }

            options.unshift({
              label: OpLyr.title,
              value: OpLyr.title,
              url: OpLyr.layerObject.url,
              use: OpLyr.use,
              imageData: OpLyr.imageData,
              id: OpLyr.id,
              type: OpLyr.type,
              renderer: OpLyr.layerObject.renderer,
              geometryType: OpLyr.layerObject.geometryType
            });
          }
        }
        this.layer_options = lang.clone(options);
      },

      setConfig: function (config) {
        this.config = config;

        if (this.config.mainPanelText) {
          this.mainPanelText.set('value', this.config.mainPanelText);
        }
        if (this.config.mainPanelIcon) {
          this.panelMainIcon.innerHTML = this.config.mainPanelIcon;
        }

        if (this.config.refreshInterval) {
          this.refreshInterval.set('value', this.config.refreshInterval);
        }

        this.layerTable.clear();
        for (var i = 0; i < this.config.layerInfos.length; i++) {

          var lyrInfo = this.config.layerInfos[i];
          this._populateLayerRow(lyrInfo);
        }
      },

      _addLayerRow: function () {
        var result = this.layerTable.addRow({});
        if (result.success && result.tr) {
          var tr = result.tr;
          this._addLayersOption(tr);
          this._addLabelOption(tr);
          this._addRefreshOption(tr);
          this._addFilterOption(tr);
        }
      },

      _populateLayerRow: function (lyrInfo) {
        var result = this.layerTable.addRow({});
        if (result.success && result.tr) {
          var tr = result.tr;
          this._addLayersOption(tr);
          this._addLabelOption(tr);
          this._addRefreshOption(tr);
          this._addFilterOption(tr);
          tr.selectLayers.set("value", lyrInfo.layer);
          tr.labelText.set("value", lyrInfo.label);
          tr.refreshBox.set("checked", lyrInfo.refresh);

          var a = domConstruct.create("div", {
            class: "imageDataGFX",
            innerHTML: [lyrInfo.imageData],
            title: this.nls.iconColumnText
          }, tr.cells[3]);

          var cLo = this._getLayerOptionByValue(lyrInfo.layer);
          cLo.filter = lyrInfo.filter;
          cLo.imageData = lyrInfo.imageData;
          cLo.symbolData = lyrInfo.symbolData;
        }
      },

      _addLayersOption: function (tr) {
        var lyrOptions = lang.clone(this.layer_options);
        var td = query('.simple-table-cell', tr)[0];
        if (td) {
          html.setStyle(td, "verticalAlign", "middle");
          var tabLayers = new Select({
            style: {
              width: "100%",
              height: "28px"
            },
            options: lyrOptions
          });
          tabLayers.placeAt(td);
          tabLayers.startup();
          tr.selectLayers = tabLayers;
          this.own(on(tabLayers, 'change', lang.hitch(this, function (v) {
            //TODO...could keep track of value change
            // TODO...could also clear the label box here...still thinking if that is appropriate
          })));
        }
      },

      _addLabelOption: function (tr) {
        var td = query('.simple-table-cell', tr)[1];
        html.setStyle(td, "verticalAlign", "middle");
        var labelTextBox = new ValidationTextBox({
          style: {
            width: "100%",
            height: "28px"
          }
        });
        labelTextBox.placeAt(td);
        labelTextBox.startup();
        tr.labelText = labelTextBox;
      },

      _addRefreshOption: function (tr) {
        var td = query('.simple-table-cell', tr)[5];
        html.setStyle(td, "verticalAlign", "middle");
        var refreshCheckBox = new CheckBox({
          //style: {
          //  "padding-left": "10px"
          //},
          onChange: lang.hitch(this, function (v) {
            //TODO has to be a better way to do this
            // just need to know the row the hosts the cbx so we can get the layer value and
            //The other thought would be to do the type check while first adding the row
            //Then here we'd just need to check if this row has a url...if not then do the popup
            //that may be better....
            var ae = this.domNode.ownerDocument.activeElement;
            var value = ae.parentNode.parentNode.parentNode.selectLayers.value;

            if (v) {
              var lyrInfo = this._getLayerOptionByValue(value);
              //if (typeof (lyrInfo.url) !== 'undefined' && lyrInfo.url !== '') {
                this.refreshLayers.push(value);
                var rO = query('.refreshOff', this.refreshOptions.domNode)[0];
                if (rO) {
                  html.removeClass(rO, 'refreshOff');
                  html.addClass(rO, 'refreshOn');
                }
              //} else {
                //this.activeLayerInfo = lyrInfo;
                //this._onSetUrlClick();
              //}
            } else {
              var i = this.refreshLayers.indexOf(value);
              if (i > -1) {
                this.refreshLayers.splice(i, 1);

                if (this.refreshLayers.length === 0) {
                  var rO = query('.refreshOn', this.refreshOptions.domNode)[0];
                  if (rO) {
                    html.removeClass(rO, 'refreshOn');
                    html.addClass(rO, 'refreshOff');
                  }
                }
              }
            }
          })
        });
        refreshCheckBox.placeAt(td);
        refreshCheckBox.startup();
        tr.refreshBox = refreshCheckBox;

        //TODO disable for StreamLayer

      },

      _addFilterOption: function (tr) {
        var td = query('.simple-table-cell', tr)[4];
        var addFilterBtn = domConstruct.create("div", {
          class: "addFilterOn",
          title: this.nls.filterBtnTitle
        }, td);
        on(addFilterBtn, "click", lang.hitch(this, function (m) {
          var lo = this._getLayerOptionByValue(m.children[0].textContent);
          this._showFilter(lo.url);
        }, tr));
      },

      _getLayerOptionByValue: function (value) {
        for (var i = 0; i < this.layer_options.length; i++) {
          var lo = this.layer_options[i];
          if (lo.value === value) {
            return lo;
          }
        }
      },

      _getLayerOptionByURL: function (url) {
        for (var i = 0; i < this.layer_options.length; i++) {
          var lo = this.layer_options[i];
          if (lo.url === url) {
            return lo;
          }
        }
      },

      _showFilter: function (url) {
        //TODO init this with any expressions from the web map layer
        var filter = new Filter({
          noFilterTip: this.nls.noFilterTip,
          style: "width:100%;margin-top:22px;"
        });

        var filterPopup = new Popup({
          titleLabel: this.nls.filterPopupTitle,
          width: 680,
          height: 485,
          content: filter,
          buttons: [{
            label: this.nls.popupOk,
            onClick: lang.hitch(this, function () {
              var partsObj = filter.toJson();
              if (partsObj && partsObj.expr) {
                var lo = this._getLayerOptionByURL(filter.url);
                lo.filter = partsObj;
                filterPopup.close();
                filterPopup = null;
              } else {
                new Message({
                  message: this.nls.filterInvalid
                });
              }
            })
          }, {
            label: this.nls.popupCancel
          }]
        });

        var lyrO = this._getLayerOptionByURL(url);
        if (lyrO.hasOwnProperty('filter')) {
          filterObj = lyrO.filter;
          filter.buildByFilterObj(url, filterObj, null);
        } else {
          filter.buildByExpr(url, null, null);
        }
      },

      _recurseOpLayers: function (pNode, pOptions) {
        var nodeGrp = pNode;
        array.forEach(nodeGrp, lang.hitch(this, function (Node) {
          if (Node.newSubLayers.length > 0) {
            this._recurseOpLayers(Node.newSubLayers, pOptions);
          } else if (Node.featureCollection) {
            if (Node.layers.length > 1) {
              this._recurseOpLayers(Node.layers, pOptions);
            }
          } else {

            if (typeof (Node.layerObject) !== 'undefined') {
              if (typeof (Node.layerObject.geometryType) === 'undefined') {
                this.setGeometryType(Node.layerObject);
              }
            }

            pOptions.push({
              label: Node.title,
              value: Node.title,
              url: Node.layerObject ? Node.layerObject.url : "",
              use: Node.use,
              imageData: Node.imageData,
              id: Node.id,
              type: Node.type,
              lyrObj: Node.layerObject
            });
          }
        }));
      },

      _pickSymbol: function (tr) {
        var selectLayersValue = tr.selectLayers.value;
        var lo = this._getLayerOptionByValue(selectLayersValue);
        this.curRow = tr;

        var options = {
          nls: this.nls,
          callerRow: tr,
          layerInfo: lo,
          value: selectLayersValue,
          symbolInfo: typeof (this.curRow.symbolData) !== 'undefined' ? this.curRow.symbolData : lo.symbolData,
          map: this.map
        };
        var sourceDijit = new SymbolPicker(options);

        var popup = new Popup({
          width: 625,
          autoHeight: true,
          content: sourceDijit,
          titleLabel: this.nls.sympolPopupTitle
        });

        this.own(on(sourceDijit, 'ok', lang.hitch(this, function (data) {
          this.curRow.cells[3].innerHTML = "<div></div>";
          this.curRow.symbolData = data;

          var newDiv = this._createImageDataDiv(data.icon);
          var r = this.layerTable.editRow(this.curRow, {
            imageData: newDiv.innerHTML
          });

          this.curRow = null;
          sourceDijit.destroy();
          sourceDijit = null;
          popup.close();
        })));

        this.own(on(sourceDijit, 'cancel', lang.hitch(this, function () {
          this.curRow = null;
          sourceDijit.destroy();
          sourceDijit = null;
          popup.close();
        })));
      },

      _createImageDataDiv: function (sym) {
        var symbol = jsonUtils.fromJson(sym);

        if (!symbol) {
          symbol = sym;
        }

        var a;
        //TODO...should I avoid hard coding these??
        if (symbol) {
          if (typeof (symbol.setWidth) !== 'undefined') {
            if (typeof (symbol.setHeight) !== 'undefined') {
              symbol.setWidth(27);
              symbol.setHeight(27);
            } else {
              symbol.setWidth(2);
            }
          } else {
            if (symbol.size > 20) {
              symbol.setSize(20);
            }
          }

          a = domConstruct.create("div", { class: "imageDataGFX" }, this.curRow.cells[3]);
          var mySurface = gfx.createSurface(a, 28, 28);
          var descriptors = jsonUtils.getShapeDescriptors(symbol);
          var shape = mySurface.createShape(descriptors.defaultShape)
                        .setFill(descriptors.fill)
                        .setStroke(descriptors.stroke);
          shape.applyTransform({ dx: 14, dy: 14 });
        } else if (typeof (sym.url) !== 'undefined') {
          a = domConstruct.create("div", { class: "imageDataGFX" }, this.curRow.cells[3]);
          domStyle.set(a, "background-image", "url(" + sym.url + ")");
          domStyle.set(a, "background-repeat", "no-repeat");
        }
        return a;
      },

      //TODO...need to ensure that we have the geometry type...when this is done
      //should remove this query from the widget
      setGeometryType: function (OpLayer) {
        var queries = [];
        if (typeof (OpLayer.url) !== 'undefined') {
          if (OpLayer.url.indexOf("MapServer")) {
            queries.push(esriRequest({ "url": OpLayer.url + "?f=json" }));
          }
        }

        if (queries.length > 0) {
          var queryList = new DeferredList(queries);
          queryList.then(lang.hitch(this, function (queryResults) {
            if (queryResults) {
              if(queryResults.length > 0) {
                var resultInfo = queryResults[0][1];
                if (this.layer_options[resultInfo.id].value === resultInfo.name) {
                  //TODO...need to loop through the results and find the match if this condition is not hit
                  //...not sure this would ever be the case but better safe than sorry
                  this.layer_options[resultInfo.id].geometryType = resultInfo.geometryType;
                  if(typeof(resultInfo.drawingInfo) !== 'undefined'){
                    this.layer_options[resultInfo.id].renderer = resultInfo.drawingInfo.renderer;
                    this.layer_options[resultInfo.id].drawingInfo = resultInfo.drawingInfo;

                    //Also need the OID field and fields
                    this.layer_options[resultInfo.id].fields = resultInfo.fields;

                    var f;
                    for (var i = 0; i < resultInfo.fields.length; i++) {
                      f = resultInfo.fields[i];
                      if(f.type === "esriFieldTypeOID"){
                        break
                      }                 
                    }
                    this.layer_options[resultInfo.id].oidFieldName = f;
                  }
                } else {
                  console.log("IDs don't match!");
                }
              }
            }
          }));
        }
      },

      uploadImage: function () {
        var reader = new FileReader();
        reader.onload = lang.hitch(this, function () {
          this.panelMainIcon.innerHTML = null;
          this.mpi = reader.result;
          domConstruct.create("div", {
            innerHTML: ['<img class="t" src="', reader.result,
                        '" title="', escape(this.nls.mainPanelIcon), '"/>'].join('')
          }, this.panelMainIcon);
        });

        this.fileInput.onchange = lang.hitch(this, function () {
          var f = this.fileInput.files[0];
          reader.readAsDataURL(f);
        });

        this.fileInput.click();
      },

      downloadRefreshConfig: function () {
        alert("Code to download the config based on widget config goes here");
      },

      downloadRefreshScript: function () {
        alert("Easy way for the user to get the script goes here");
      },

      getConfig: function () {

        if (query('.refreshOn', this.refreshOptions.domNode)[0]) {
          if (!this.refreshInterval.value) {
            new Message({
              message: this.nls.missingRefreshValue
            });
            //TODO need to figure out the correct way to prevent the popup from closing...just returning here doesn't work
            return;
          }
        }

        dijitPopup.close();

        var rows = this.layerTable.getRows();
        var table = [];
        var lInfo;
        array.forEach(rows, lang.hitch(this, function (tr) {
          var selectLayersValue = tr.selectLayers.value;

          var labelText = tr.labelText;
          var refreshBox = tr.refreshBox;
          var lo = this._getLayerOptionByValue(selectLayersValue);

          lInfo = {
            layer: selectLayersValue,
            label: labelText.value !== "" ? labelText.value : selectLayersValue,
            refresh: refreshBox.checked,
            filter: lo.filter,
            url: lo.url,
            type: lo.type,
            id: lo.id,
            symbolData: tr.symbolData ? tr.symbolData : lo.symbolData,
            geometryType: lo.geometryType,
            itemId: lo.itemId,
            renderer: lo.renderer,
            drawingInfo: lo.drawingInfo,
            fields: lo.fields,
            oidFieldName: lo.oidFieldName
          };

          var td = query('.imageDataGFX', tr)[0];
          lInfo.imageData = typeof (td) !== 'undefined' ? td.innerHTML : "<div></div>";
          table.push(lInfo);
        }));

        this.config.layerInfos = table;
        this.config.mainPanelText = this.mainPanelText.value;
        this.config.mainPanelIcon = this.panelMainIcon.innerHTML;
        this.config.refreshInterval = this.refreshInterval.value;

        this.config.refreshEnabled = this.refreshLayers.length > 0 ? true : false;
       
        //TODO test running the queries here
        //still thinking through this...but if I grabbed the features here then on open it would just be a matter
        // of loading the appropriate map layer...this would definately minimize the load time
        // but it would also be writing a static copy of the data to the config...not sure if that is a bad idea or not
        //

        return this.config;
      },

      destroy: function () {
        dijitPopup.close();
        this.inherited(arguments);
      }
    });
  });
