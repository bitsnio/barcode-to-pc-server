import { Component, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Alert, AlertButton, AlertController, Events, Navbar, NavController, NavParams } from 'ionic-angular';
import moment from 'moment';
import { DragulaService } from "ng2-dragula";
import { Observable } from 'rxjs/Observable';
import { fromEvent } from 'rxjs/observable/fromEvent';
import { interval } from 'rxjs/observable/interval';
import { tap, throttle } from 'rxjs/operators';
import { Subscription } from 'rxjs/Subscription';
import { Config } from '../../config';
import { NutjsKey } from '../../models/nutjs-key.model';
import { OutputBlockModel } from '../../models/output-block.model';
import { OutputProfileModel } from '../../models/output-profile.model';
import { SettingsModel } from '../../models/settings.model';
import { ElectronProvider } from '../../providers/electron/electron';
import { LicenseProvider } from '../../providers/license/license';
import { UtilsProvider } from '../../providers/utils/utils';

/**
 * Generated class for the SettingsPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@Component({
  selector: 'page-settings',
  templateUrl: 'settings.html',
})
export class SettingsPage implements OnInit, OnDestroy {
  @ViewChild(Navbar) navBar: Navbar;

  public unsavedSettingsAlert: Alert;
  public settings: SettingsModel = new SettingsModel(UtilsProvider.GetOS());
  public availableOutputBlocks: OutputBlockModel[] = this.getAvailableOutputBlocks();

  private lastSavedSettings: string;

  public selectedOutputProfile = 0;
  static MAX_SCAN_SESSION_NUMBER_UNLIMITED = 2000; // Update also SettingsModel.maxScanSessionsNumber


  private getAvailableOutputBlocks(): OutputBlockModel[] {
    // Warning: update scan.model.ts/ToString() and ToCSV() when changing the
    // array below and also enforce compatibility with the previous versions by
    // adding an upgrade script in the app.component.ts/upgrade() method.
    return [
      { name: 'PRESS KEY', value: '', keyId: NutjsKey.Space, type: 'key', modifierKeys: [] },
      { name: 'ENTER', value: '', keyId: NutjsKey.Enter, type: 'key', modifierKeys: [] },
      { name: 'TAB', value: '', keyId: NutjsKey.Tab, type: 'key', modifierKeys: [] },

      // **VARIABLES**
      { name: 'DATE_TIME', value: '', type: 'date_time', skipOutput: false, label: null, format: 'YYYY-MM-DD', locale: moment.locale(), matchBarcodeDate: true },
      { name: 'TIMESTAMP', value: 'timestamp', type: 'variable', skipOutput: false, label: null },
      // { name: 'DATE', value: 'date', type: 'variable', skipOutput: false },
      // { name: 'TIME', value: 'time', type: 'variable', skipOutput: false },
      // { name: 'DATE_TIME', value: 'date_time', type: 'variable', skipOutput: false },
      { name: 'SCAN_SESSION_NAME', value: 'scan_session_name', type: 'variable', skipOutput: false, label: null },
      // { name: 'SCAN_INDEX', value: 'scan_index', type: 'variable', skipOutput: false },
      { name: 'DEVICE_NAME', value: 'deviceName', type: 'variable', skipOutput: false, label: null },
      { name: 'NUMBER', value: 'number', type: 'variable', skipOutput: false, label: null, filter: null, errorMessage: null, defaultValue: '1' },
      { name: 'TEXT', value: 'text', type: 'variable', skipOutput: false, label: null, filter: null, errorMessage: null, defaultValue: null },
      // Warning: keep in sync with settings.model.ts
      { name: 'BARCODE', value: 'BARCODE', type: 'barcode', skipOutput: false, label: null, enabledFormats: [], filter: null, errorMessage: null },

      // **CONSTANTS**
      { name: 'Static text', value: '', type: 'text', skipOutput: false, label: null },

      // **DELAY**
      { name: 'Delay', value: '', type: 'delay' },

      // **CONSTRUCTS**
      { name: 'IF', value: '', type: 'if' },
      { name: 'ENDIF', value: 'endif', type: 'endif' },

      // **OTHER**
      { name: 'JAVASCRIPT_FUNCTION', value: '', type: 'function', skipOutput: false, label: null },
      { name: 'SELECT_OPTION', value: '', type: 'select_option', title: '', message: '', skipOutput: false, label: null },
      { name: 'HTTP', value: '', type: 'http', httpMethod: 'get', httpData: null, httpParams: null, httpHeaders: null, httpOAuthMethod: 'disabled', httpOAuthConsumerKey: null, httpOAuthConsumerSecret: null, skipOutput: false, label: null, timeout: 10000 },
      { name: 'RUN', value: '', type: 'run', skipOutput: false, label: null, timeout: 10000 },
      { name: 'CSV_LOOKUP', value: '{{ barcode }}', type: 'csv_lookup', skipOutput: false, label: null, csvFile: '', searchColumn: 1, resultColumn: 2, notFoundValue: '', delimiter: ',' },
      { name: 'CSV_UPDATE', value: '{{ barcode }}', type: 'csv_update', skipOutput: false, label: null, csvFile: '', searchColumn: 1, columnToUpdate: 2, rowToUpdate: 'first', newValue: '', notFoundValue: '', delimiter: ',' },
      { name: 'BEEP', value: 'beep', type: 'beep', beepsNumber: 1, beepSpeed: 'medium' },
      { name: 'ALERT', value: '', type: 'alert', alertTitle: 'Alert', alertDiscardScanButton: 'Discard scan', alertScanAgainButton: 'Scan again', alertOkButton: 'Ok' },
      { name: 'WOOCOMMERCE', value: 'createProduct', type: 'woocommerce', fields: [], consumer_key: '', consumer_secret: '', url_woocommerce: '', skipOutput: true, label: null },
    ];
  }


  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private dragulaService: DragulaService,
    private electronProvider: ElectronProvider,
    private licenseProvider: LicenseProvider,
    private alertCtrl: AlertController,
    public events: Events,
    private ngZone: NgZone,
    private utils: UtilsProvider,
  ) {
    this.dragulaService.destroy('dragula-group')
    this.dragulaService.createGroup('dragula-group', {
      copy: (el, source) => {
        return source.id === 'left';
      },
      accepts: (el, target, source, sibling) => {
        // To avoid dragging from right to left container
        return target.id !== 'left';
      },
      copyItem: (item: OutputBlockModel) => {
        return JSON.parse(JSON.stringify(item));
      },
      removeOnSpill: true
    });

    this.dragulaService.dropModel('dragula-group').subscribe(async ({ name, el, target, source, sibling, item, sourceModel, targetModel, }) => {
      if (item.value == 'number') {
        if (!(await this.licenseProvider.canUseNumberParameter(true))) {
          setTimeout(() => this.settings.outputProfiles[this.selectedOutputProfile].outputBlocks = this.settings.outputProfiles[this.selectedOutputProfile].outputBlocks.filter(x => x.value != 'number'), 1000)
        }
      }
    });
  }

  public getAppName() {
    return Config.APP_NAME;
  }

  public canAddMoreComponents() {
    return this.settings.outputProfiles[this.selectedOutputProfile].outputBlocks.length < this.licenseProvider.getNOMaxComponents();
  }

  public onSubscribeClick() {
    this.licenseProvider.showPricingPage('customOutputFieldOnSubscribeClick');
  }

  ionViewDidLoad() {
    this.settings = this.electronProvider.store.get(Config.STORAGE_SETTINGS, new SettingsModel(UtilsProvider.GetOS()));
    this.lastSavedSettings = JSON.stringify(this.settings);
    this.navBar.backButtonClick = (e: UIEvent) => {
      this.goBack();
    }
  }

  // willExit -> apply

  onApplyClick() {
    this.apply();
  }

  async onRestoreDefaultSettingsClick() {
    this.alertCtrl.create({
      title: await this.utils.text('restoreDefaultSettingsDialogTitle'),
      message: await this.utils.text('restoreDefaultSettingsDialogMessage'),
      buttons: [{
        text: await this.utils.text('restoreDefaultSettingsDialogCancelButton'), role: 'cancel'
      }, {
        text: await this.utils.text('restoreDefaultSettingsDialogRestoreButton'), handler: (opts) => {
          localStorage.setItem('woocommerce_parameters', null);
          this.settings = new SettingsModel(UtilsProvider.GetOS());
          this.apply();
        }
      }]
    }).present();
  }

  async apply(pop = false) {
    let noIfs = this.settings.outputProfiles[this.selectedOutputProfile].outputBlocks.filter(x => x.type == 'if').length;
    let noEndIfs = this.settings.outputProfiles[this.selectedOutputProfile].outputBlocks.filter(x => x.type == 'endif').length;
    if (noIfs != noEndIfs) {
      let buttons: AlertButton[] = [{ text: await this.utils.text('applyDialogOKButton'), role: 'cancel', },];
      if (pop) {
        buttons.unshift({ text: await this.utils.text('applyDialogDiscardButton'), handler: () => { this.navCtrl.pop(); } });
      }
      this.alertCtrl.create({
        title: await this.utils.text('syntaxErrorDialogTitle'),
        message: await this.utils.text('syntaxErrorDialogMessage'),
        buttons: buttons
      }).present();
      return false;
    }

    this.electronProvider.store.set(Config.STORAGE_SETTINGS, this.settings);
    if (ElectronProvider.isElectron()) {
      this.electronProvider.appSetLoginItemSettings({
        openAtLogin: (this.settings.openAutomatically == 'yes' || this.settings.openAutomatically == 'minimized'),
        openAsHidden: this.settings.openAutomatically == 'minimized'
      })
    }
    this.lastSavedSettings = JSON.stringify(this.settings);
    if (ElectronProvider.isElectron()) {
      this.electronProvider.ipcRenderer.send('settings');
    }

    if (pop) {
      this.navCtrl.pop();
    }
  }

  async onEditOutputProfileNameClick() {
    let currentProfile = this.settings.outputProfiles[this.selectedOutputProfile];
    this.alertCtrl.create({
      title: await this.utils.text('outputTemplateNameDialogTitle'),
      // message: 'Inse',
      enableBackdropDismiss: false,
      inputs: [{ name: 'name', type: 'text', placeholder: currentProfile.name, value: currentProfile.name }],
      buttons: [{
        role: 'cancel',
        text: await this.utils.text('outputTemplateNameDialogCancelButton'),
        handler: () => { }
      }, {
        text: await this.utils.text('outputTemplateNameDialogOkButton'),
        handler: data => {
          if (data.name != "") {
            this.settings.outputProfiles[this.selectedOutputProfile].name = data.name;
          }
        }
      }]
    }).present();
  }

  async onDeleteOutputTemplateClick() {
    if (this.settings.outputProfiles.length <= 1) {
      return;
    }

    this.alertCtrl.create({
      title: await this.utils.text('deleteOutputTemplateDialogTitle'),
      message: await this.utils.text('deleteOutputTemplateDialogMessage'),
      buttons: [{
        text: await this.utils.text('deleteOutputTemplateDialogYesButton'),
        handler: () => {
          // change the selected OutputProfile
          let selectedIndex = this.selectedOutputProfile;
          this.selectedOutputProfile = selectedIndex == 0 ? selectedIndex : selectedIndex - 1;

          // remove the selected OutputProfile
          this.settings.outputProfiles = this.settings.outputProfiles.filter((x, index) => index != selectedIndex);
        }
      }, {
        text: await this.utils.text('deleteOutputTemplateDialogCancelButton'),
        role: 'cancel',
        handler: () => { }
      }]
    }).present();
  }

  async onExportOutputTemplateClick() {
    let outputProfile = this.settings.outputProfiles[this.selectedOutputProfile];
    outputProfile.version = this.electronProvider.appGetVersion()

    const filePath = this.electronProvider.showSaveDialogSync({
      title: await this.utils.text('saveDialogTitle'),
      defaultPath: outputProfile.name + '.btpt',
      buttonLabel: await this.utils.text('saveDialogSaveButton'),
      filters: [{
        name: await this.utils.text('saveDialogFilterName', {
          "appName": Config.APP_NAME,
        }), extensions: ['btpt',]
      }],
    });

    if (!filePath) return;
    this.electronProvider.fsWriteFileSync(filePath, JSON.stringify(outputProfile), 'utf-8');
  }

  async onImportOutputTemplateClick() {
    let filePaths = this.electronProvider.showOpenDialogSync({
      title: await this.utils.text('importDialogTitle'),
      buttonLabel: await this.utils.text('importDialogSelectButton'),
      defaultPath: this.electronProvider.appGetPath('desktop'),
      filters: [{
        name: await this.utils.text('saveDialogFilterName', {
          "appName": Config.APP_NAME,
        }), extensions: ['btpt']
      }],
      properties: ['openFile', 'createDirectory', 'promptToCreate',]
    });

    if (!filePaths || !filePaths[0]) return;

    // almost duplicate code on app.component.ts
    try {
      const data = this.electronProvider.fsReadFileSync(filePaths[0], { encoding: 'utf-8' });
      const templateObj = JSON.parse(data);
      const template = this.utils.upgradeTemplate(templateObj, templateObj.version);
      this.addOutputTemplate(template);
    } catch {
      const path = this.electronProvider.path;
      this.alertCtrl.create({
        title: await this.utils.text('openFileErrorDialogTitle'),
        message: await this.utils.text('openFileErrorDialogMessage', {
          "path": path.basename(filePaths[0]),
        }),
        buttons: [{ text: await this.utils.text('openFileErrorDialogOkButton'), role: 'cancel', }]
      }).present();
      return;
    }
  }

  async onNewOutputTemplateClick() {
    let newTemplateName = await this.utils.text('newOutputTemplateName', {
      "number": (this.settings.outputProfiles.length + 1)
    });
    this.alertCtrl.create({
      title: await this.utils.text('newOutputTemplateDialogTitle'),
      message: await this.utils.text('newOutputTemplateDialogMessage'),
      enableBackdropDismiss: false,
      inputs: [{ name: 'name', type: 'text', placeholder: newTemplateName }],
      buttons: [{
        role: 'cancel', text: await this.utils.text('newOutputTemplateDialogCancelButton'),
        handler: () => { }
      }, {
        text: await this.utils.text('newOutputTemplateDialogOkButton'),
        handler: data => {
          if (data.name != "") {
            newTemplateName = data.name;
          }
          let outputTemplate: OutputProfileModel = {
            name: newTemplateName,
            version: null,
            outputBlocks: new SettingsModel(UtilsProvider.GetOS()).outputProfiles[0].outputBlocks
          };
          this.addOutputTemplate(outputTemplate)
        }
      }]
    }).present();
  }

  addOutputTemplate(outputTemplate) {
    // push isn't working, so we're using the spread operator (duplicated issue on the app.compoennt.ts file)
    this.settings.outputProfiles = [...this.settings.outputProfiles, outputTemplate];
    this.selectedOutputProfile = this.settings.outputProfiles.length - 1;
  }

  public settingsChanged = false;
  private checkSettingsChanged() {
    this.settingsChanged = this.lastSavedSettings != JSON.stringify(this.settings);
    return this.settingsChanged;
  }

  async goBack() {
    if (!this.checkSettingsChanged()) { // settings up to date
      this.navCtrl.pop();
    } else { // usnaved settings
      this.unsavedSettingsAlert = this.alertCtrl.create({
        title: await this.utils.text('unsavedSettingsDialogTitle'),
        message: await this.utils.text('unsavedSettingsDialogMessage'),
        buttons: [{
          text: await this.utils.text('unsavedSettingsDialogSaveButton'),
          handler: () => {
            this.apply(true);
          }
        }, {
          text: await this.utils.text('unsavedSettingsDialogDiscardButton'),
          role: 'cancel',
          handler: () => {
            this.navCtrl.pop();
          }
        }]
      });
      this.unsavedSettingsAlert.present();
    }
  }

  async onSelectCSVPathClick() {
    let defaultPath = this.settings.csvPath;
    if (!defaultPath) {
      defaultPath = this.electronProvider.appGetPath('desktop')
    }

    let filePaths = this.electronProvider.showOpenDialogSync({
      title: await this.utils.text('selectCSVPathDialog'),
      buttonLabel: await this.utils.text('selectCSVSelectButton'),
      defaultPath: defaultPath,
      filters: [
        { name: await this.utils.text('selectCSVFilterText'), extensions: ['txt', 'csv', 'log'] },
        { name: await this.utils.text('selectCSVFilterAll'), extensions: ['*'] }
      ],
      properties: ['openFile', 'createDirectory', 'promptToCreate',]
    });

    if (filePaths && filePaths.length) {
      this.settings.csvPath = filePaths[0];
    }
  }

  // Handle changes dection through 'mouseup' and 'keyup' DOM events
  // This way it's more efficient compared to the angular way.
  private domEvents: Subscription;
  ngOnInit(): void {
    let events = Observable.merge(fromEvent(window, 'mouseup'), fromEvent(window, 'keyup'));
    this.domEvents = events.pipe(
      throttle(ev => interval(1000), { leading: true, trailing: true }),
      tap(event => this.checkSettingsChanged()),
      tap(event => this.domEvent(event)),
    ).subscribe();
  }
  ngOnDestroy(): void {
    this.domEvents.unsubscribe(); // don't forget to unsubscribe
  }

  // ESC button => Go back
  domEvent(event) {
    if (event.keyCode && event.keyCode == 27 && !this.unsavedSettingsAlert && this.electronProvider.isDev) {
      this.events.publish('settings:goBack');
      this.goBack();
    }
  }

  async onCSVClick() {
    if (this.settings.appendCSVEnabled) {
      if (!(await this.licenseProvider.canUseCSVAppend(true))) {
        setTimeout(() => this.settings.appendCSVEnabled = false, 1000)
      }
    }
  }

  onOpenAutomaticallyChange() {
    if (this.settings.openAutomatically == 'minimized' && this.electronProvider.processPlatform === 'darwin') {
      this.settings.enableTray = true;
    }
  }

  getMaxScanSessionNumberReadable() {
    if (this.settings.maxScanSessionsNumber == SettingsPage.MAX_SCAN_SESSION_NUMBER_UNLIMITED) return "Unlimited";
    return this.settings.maxScanSessionsNumber;
  }
  getMaxScanSessionNumber() { return SettingsPage.MAX_SCAN_SESSION_NUMBER_UNLIMITED };
  onMaxScanSessionNumberChange(e) {
    this.checkSettingsChanged();
  }
}
