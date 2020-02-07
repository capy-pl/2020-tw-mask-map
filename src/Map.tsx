import React from "react";

import { getPosition } from "./util";
import { Pharmacy } from "./Model";
import { calcCrow, cleanDateString } from "./util";
import MaskEnoughIcon from "./icons/mask-enough.svg";
import MaskNone from "./icons/mask-none.svg";
import MaskUnderTen from "./icons/mask-under-ten.svg";
import { Button, Icon, Segment, List, Image } from "semantic-ui-react";

type Props = {
  pharmacies: Pharmacy[];
  toggleMapView: () => void;
};

type MaskSituation = "enough" | "lessThanTen" | "none";

export default class GoogleMap extends React.PureComponent<Props> {
  public rootRef = React.createRef<HTMLDivElement>();
  public legendRef = React.createRef<HTMLDivElement>();
  private map?: google.maps.Map;
  private markers: Map<number, google.maps.Marker> = new Map();
  private currentOpen?: google.maps.InfoWindow;

  public async componentDidMount() {
    if (this.rootRef && this.rootRef.current) {
      // auto calculate height.
      const opt: google.maps.MapOptions = {
        streetViewControl: false,
        zoomControl: false,
        mapTypeControl: false,
        fullscreenControl: false
      };
      try {
        const position = await getPosition();
        opt.center = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        opt.zoom = 17;
      } catch (err) {
        opt.center = {
          lat: 25.0451957,
          lng: 121.5198828
        };
        opt.zoom = 11;
      }
      this.map = new google.maps.Map(this.rootRef.current, opt);
      this.map.addListener("center_changed", this.onCenterChange());
      this.drawMarkers();
    }
  }

  public componentDidUpdate() {
    this.drawMarkers();
  }

  public changeCenter = async () => {
    try {
      if (this.map) {
        const position = await getPosition();
        this.map.panTo({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      }
    } catch (err) {}
  };

  public onCenterChange = () => {
    const interval = 100;
    let previousTrigger = new Date();
    return () => {
      const currentTrigger = new Date();
      if (currentTrigger.getTime() - previousTrigger.getTime() > interval) {
        previousTrigger = currentTrigger;
        this.drawMarkers();
      }
    };
  };

  public sortedDistanceMap(): number[] {
    // Initialize a index list.
    const indexList = [];
    for (let i = 0; i < this.props.pharmacies.length; i++) {
      indexList[i] = i;
    }
    if (this.map) {
      indexList.sort((ph1, ph2) => {
        const [plng1, plat1] = this.props.pharmacies[ph1].geometry.coordinates;
        const [plng2, plat2] = this.props.pharmacies[ph2].geometry.coordinates;
        const { lat, lng } = (this.map as google.maps.Map).getCenter().toJSON();
        const ph1Distance = calcCrow(lat, lng, plat1, plng1);
        const ph2Distance = calcCrow(lat, lng, plat2, plng2);
        if (ph1Distance < ph2Distance) return -1;
        if (ph1Distance === ph2Distance) return 0;
        return 1;
      });
    }
    return indexList;
  }

  public maskSituation(num: number): MaskSituation {
    if (num > 10) return "enough";
    if (num > 0) return "lessThanTen";
    return "none";
  }

  public getIcon(situation1: MaskSituation, situation2: MaskSituation): string {
    if (situation1 === "enough" || situation2 === "enough")
      return MaskEnoughIcon;
    if (situation1 === "lessThanTen" || situation2 === "lessThanTen")
      return MaskUnderTen;
    return MaskNone;
  }

  public getCellClass(situation: MaskSituation): string {
    switch (situation) {
      case "enough":
        return "positive";
      case "lessThanTen":
        return "warning";
      default:
        return "negative";
    }
  }

  public drawMarkers = () => {
    const sortedMap = this.sortedDistanceMap().slice(0, 30);
    // clear all previous markers
    const notInList: number[] = [];
    this.markers.forEach((marker, id) => {
      if (!sortedMap.includes(id)) {
        marker.setMap(null);
        notInList.push(id);
      }
    });

    notInList.forEach(index => {
      this.markers.delete(index);
    });

    sortedMap.forEach(index => {
      this.drawMarker(index);
    });
  };

  public drawMarker = (index: number) => {
    if (!this.markers.has(index)) {
      const pharmacy: Pharmacy = this.props.pharmacies[index];
      const adultMaskAvailable: MaskSituation = this.maskSituation(
        pharmacy.properties.mask_adult
      );
      const childMaskAvailable: MaskSituation = this.maskSituation(
        pharmacy.properties.mask_child
      );

      const icon: google.maps.Icon = {
        url: this.getIcon(adultMaskAvailable, childMaskAvailable),
        scaledSize: new google.maps.Size(40, 40)
      };

      const contentString = `
        <div class="info-box">
          <h3 class="ui top attached header">
            ${pharmacy.properties.name}
          </h3>
          <table class="ui celled table compact">
          <tbody>
          <tr>
          <td class="collapsing ${this.getCellClass(
            adultMaskAvailable
          )}">成人口罩庫存</td>
          <td data-label="availabe adult masks" class=" ${this.getCellClass(
            adultMaskAvailable
          )} collapsing">${pharmacy.properties.mask_adult}</td>
        </tr>
        <tr>
          <td class="collapsing  ${this.getCellClass(
            childMaskAvailable
          )}" >孩童口罩庫存</td>
          <td data-label="available child masks" class="${this.getCellClass(
            childMaskAvailable
          )} collapsing">${pharmacy.properties.mask_child}</td>
        </tr>
            <tr class="collapsing">
              <td class="collapsing">地址</td>
              <td class="collapsing" data-label="address">${
                pharmacy.properties.address
              }</td>
            </tr>
            <tr class="collapsing">
              <td  class="collapsing">電話</td>
              <td class="collapsing" data-label="phone number">${
                pharmacy.properties.phone
              }</td>
            </tr>
            <tr>
              <td class="collapsing">最後更新時間</td>
              <td class="collapsing" data-label="last update">${cleanDateString(
                pharmacy.properties.updated || ""
              )}</td>
            </tr>
          </tbody>
        </table>
        </div>
      `;

      const infowindow = new google.maps.InfoWindow({
        content: contentString
      });

      const marker = new google.maps.Marker({
        position: {
          lat: pharmacy.geometry.coordinates[1],
          lng: pharmacy.geometry.coordinates[0]
        },
        icon,
        cursor: "pointer",
        map: this.map
      });

      marker.addListener("click", () => {
        if (this.currentOpen) {
          this.currentOpen.close();
        }
        this.currentOpen = infowindow;
        infowindow.open(this.map, marker);
      });

      this.markers.set(index, marker);
    } else {
      this.markers.get(index)?.setMap(this.map as google.maps.Map);
    }
  };

  public render() {
    return (
      <>
        <div id="legend" ref={this.legendRef}>
          <Segment compact style={{ padding: "0.4rem" }}>
            <List verticalAlign="middle">
              <List.Item>
                <Image src={MaskUnderTen} size="mini" />
                <List.Content>
                  <List.Header>口罩供應小於１０</List.Header>
                </List.Content>
              </List.Item>
              <List.Item>
                <Image src={MaskEnoughIcon} size="mini" />
                <List.Content>
                  <List.Header>口罩供應足夠</List.Header>
                </List.Content>
              </List.Item>
              <List.Item>
                <Image src={MaskNone} size="mini" />
                <List.Content>
                  <List.Header>口罩售罄</List.Header>
                </List.Content>
              </List.Item>
            </List>
          </Segment>
        </div>

        <Button
          style={{ zIndex: 40 }}
          icon
          labelPosition="left"
          color="facebook"
          onClick={this.changeCenter}
          className="locate-icon"
        >
          顯示我的位置
          <Icon name="location arrow" />
        </Button>
        <Button
          style={{ zIndex: 40 }}
          className="toggle-map-icon"
          onClick={this.props.toggleMapView}
        >
          切換文字選單
        </Button>
        <div id="map-root" ref={this.rootRef}></div>
      </>
    );
  }
}
