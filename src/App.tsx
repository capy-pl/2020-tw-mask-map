import axios from "axios";
import React from "react";
import {
  Button,
  Dimmer,
  Dropdown,
  Icon,
  DropdownProps,
  Form,
  Loader,
  Input,
  Menu,
  Popup,
  Segment,
  Table
} from "semantic-ui-react";

import { cleanDateString, calcCrow } from "./util";

import "./App.css";

type PharmacyAjaxResponse = {
  type: string;
  features: Pharmacy[];
};

type Pharmacy = {
  type: string;
  properties: PharmacyProps;
  geometry: Geometry;
};

type PharmacyProps = {
  id: number;
  name: string;
  phone: string;
  address: string;
  mask_adult: number;
  mask_child: number;
  updated?: string;
  available: string;
  mark_adult: number;
  mark_child: number;
};

type Geometry = {
  type: string;
  coordinates: number[];
};

type State = {
  pharmacies: Pharmacy[];
  ajaxError: boolean;
  loading: boolean;
  searchValue: string;
  display: number[];
  errMessage: string;
  adultMaskAvailable: boolean;
  childMaskAvailable: boolean;
  nearest: boolean;
  currentPage: number;
  pageSize: number;
  hasNext: boolean;
  startPage: number;
  numberLeft: number;
  availableNums: number;
  pageNums: number;
};

type Condition = {
  childMaskAvailable?: boolean;
  adultMaskAvailable?: boolean;
  searchString?: string;
};

class App extends React.PureComponent<{}, State> {
  public timer?: number;
  public lastSearchResult: string = "";
  public pageLimit: number = 5;

  public state = {
    ajaxError: false,
    notFoundError: false,
    pharmacies: [],
    loading: true,
    searchValue: "",
    display: [],
    errMessage: "",
    adultMaskAvailable: false,
    childMaskAvailable: false,
    nearest: false,
    currentPage: 1,
    pageSize: 15,
    hasNext: false,
    startPage: 1,
    numberLeft: 0,
    availableNums: 0,
    pageNums: 0
  };

  public async componentDidMount() {
    // fetch data every 3 minutes.
    const interval = 3 * 60 * 1000;
    const pageNum = await this.fetchData();
    this.updatePageNumber(pageNum);
    this.timer = window.setInterval(this.fetchData, interval);
  }

  public componentWillUnmount() {
    clearInterval(this.timer);
    delete this.timer;
  }

  public fetchData = async () => {
    const response = await axios.get<PharmacyAjaxResponse>(
      "https://raw.githubusercontent.com/kiang/pharmacies/master/json/points.json"
    );

    if (response.status >= 400) {
      this.setState({
        ajaxError: true,
        errMessage: "無法與伺服器連線。"
      });
    }

    if (response.status === 200) {
      this.setState(
        {
          ajaxError: false,
          loading: false,
          pharmacies: response.data.features,
          availableNums: response.data.features.length
        },
        () => {
          this.updateList({
            searchString: this.lastSearchResult,
            adultMaskAvailable: this.state.adultMaskAvailable,
            childMaskAvailable: this.state.childMaskAvailable
          });
        }
      );
      return response.data.features.length;
    }
    return 0;
  };

  public updatePageNumber(newLength: number) {
    this.setState({
      pageNums: Math.ceil(newLength / this.state.pageSize)
    });
  }

  public getPosition(): Promise<Position> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject);
    });
  }

  public searchAddress = (address: string) => {
    return () => {
      const element = document.createElement("a");
      element.href = `https://maps.google.com?q=${address}`;
      element.target = "_blank";
      element.click();
    };
  };

  public renderPharmacy = (pharmacy: Pharmacy) => {
    return (
      <Table.Row key={pharmacy.properties.id}>
        <Table.Cell>{pharmacy.properties.name}</Table.Cell>
        <Table.Cell>
          {pharmacy.properties.address}
          <Popup
            content="點擊可切換到Google Map顯示位置"
            trigger={
              <Icon
                link
                name="tag"
                style={{ marginLeft: "0.5rem" }}
                onClick={this.searchAddress(pharmacy.properties.address)}
              />
            }
          />
        </Table.Cell>
        <Table.Cell>{pharmacy.properties.phone}</Table.Cell>
        <Table.Cell>{pharmacy.properties.mask_adult}</Table.Cell>
        <Table.Cell>{pharmacy.properties.mask_child}</Table.Cell>
        <Table.Cell>
          {cleanDateString(pharmacy.properties.updated || "")}
        </Table.Cell>
      </Table.Row>
    );
  };

  public renderPharmacyList = () => {
    const startIndex = (this.state.currentPage - 1) * this.state.pageSize;
    const endIndex =
      this.state.currentPage * this.state.pageSize - 1 <
      this.state.availableNums
        ? this.state.currentPage * this.state.pageSize
        : this.state.availableNums;
    if (!this.state.notFoundError && this.state.pharmacies.length) {
      if (!this.state.display.length) {
        return (this.state.pharmacies as Pharmacy[])
          .slice(startIndex, endIndex)
          .map(this.renderPharmacy);
      }
      return this.state.display
        .slice(startIndex, endIndex)
        .map(index => this.renderPharmacy(this.state.pharmacies[index]));
    }
  };

  public onSearchValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({
      searchValue: e.target.value
    });
  };

  private toggleAdultMaskAvailable = () => {
    this.updateList({
      searchString: this.lastSearchResult,
      childMaskAvailable: this.state.childMaskAvailable,
      adultMaskAvailable: !this.state.adultMaskAvailable
    });
  };

  private toggleChildrenMaskAvailable = () => {
    this.updateList({
      searchString: this.lastSearchResult,
      childMaskAvailable: !this.state.childMaskAvailable,
      adultMaskAvailable: this.state.adultMaskAvailable
    });
  };

  public onSubmit = () => {
    const val = this.state.searchValue.trim();
    if (val) {
      this.lastSearchResult = val;
    } else {
      delete this.lastSearchResult;
    }
    this.updateList({
      searchString: val,
      childMaskAvailable: this.state.childMaskAvailable,
      adultMaskAvailable: this.state.adultMaskAvailable
    });
  };

  public updateList(condition: Condition) {
    const matchList: number[] = [];
    (this.state.pharmacies as Pharmacy[]).forEach((pharmacy, index) => {
      if (this.validatePharmacy(pharmacy, condition)) {
        matchList.push(index);
      }
    });
    this.setState({
      childMaskAvailable: !!condition.childMaskAvailable,
      adultMaskAvailable: !!condition.adultMaskAvailable,
      display: matchList,
      availableNums: matchList.length,
      pageNums: matchList.length / this.state.pageSize,
      startPage: 1,
      currentPage: 1
    });
  }

  private validatePharmacy(pharmacy: Pharmacy, condition: Condition): boolean {
    let isValid: boolean = true;
    if (condition.searchString && condition.searchString.length) {
      isValid =
        pharmacy.properties.address.includes(condition.searchString) ||
        pharmacy.properties.name.includes(condition.searchString);
    }
    if (condition.adultMaskAvailable) {
      isValid = isValid && pharmacy.properties.mask_adult > 0;
    }
    if (condition.childMaskAvailable) {
      isValid = isValid && pharmacy.properties.mask_child > 0;
    }

    return isValid;
  }

  private sortByGeolocation = async () => {
    try {
      const location = await this.getPosition();
      const { latitude, longitude } = location.coords;
      const indexList = (this.state.display as number[]).slice();
      const distanceMap = new Map<number, number>();
      (this.state.display as number[]).forEach(index => {
        const [plongitude, platitude] = (this.state.pharmacies as Pharmacy[])[
          index
        ].geometry.coordinates;
        const distance = calcCrow(latitude, longitude, platitude, plongitude);
        distanceMap.set(
          (this.state.pharmacies as Pharmacy[])[index].properties.id,
          distance
        );
      });
      indexList.sort((index1, index2) => {
        const ph1 = (this.state.pharmacies as Pharmacy[])[index1].properties.id;
        const ph2 = (this.state.pharmacies as Pharmacy[])[index2].properties.id;
        const ph1Distance = distanceMap.get(ph1) as number;
        const ph2Distance = distanceMap.get(ph2) as number;
        if (ph1Distance < ph2Distance) return -1;
        if (ph1Distance === ph2Distance) return 0;
        return 1;
      });
      this.setState({
        display: indexList
      });
    } catch (err) {}
  };

  public get hasNext() {
    return this.state.startPage + 4 < this.state.pageNums;
  }

  public get numberLeft() {
    return this.state.pageNums - this.state.startPage + 1;
  }

  public getPageOptions = () => {
    return [15, 25, 50].map(value => ({
      key: value,
      text: value.toString(),
      value
    }));
  };

  public onPageSizeChange = (
    event: React.SyntheticEvent<HTMLElement, Event>,
    data: DropdownProps
  ) => {
    this.setState({
      pageSize: data.value as number,
      currentPage: 1,
      startPage: 1,
      pageNums: Math.ceil(this.state.availableNums / (data.value as number))
    });
  };

  public changePage = (i: number) => {
    return () => {
      this.setState({
        currentPage: i
      });
    };
  };

  public renderPageItems(): JSX.Element[] {
    const items: JSX.Element[] = [];
    const max: number = this.hasNext
      ? this.state.startPage + this.pageLimit
      : this.state.startPage + (this.numberLeft as number);
    for (let i = this.state.startPage; i < max; i++) {
      items.push(
        <Menu.Item
          key={i}
          active={this.state.currentPage === i}
          onClick={this.changePage(i)}
          as="a"
        >
          {i}
        </Menu.Item>
      );
    }
    return items;
  }

  public previousPages = () => {
    this.setState({
      startPage: this.state.startPage - 5,
      currentPage: this.state.startPage - 5
    });
  };

  public nextPages = () => {
    this.setState({
      startPage: this.state.startPage + 5,
      currentPage: this.state.startPage + 5
    });
  };

  public render() {
    return (
      <>
        <Dimmer active={this.state.loading} page>
          <Loader />
        </Dimmer>
        <Menu borderless fixed="top">
          <Menu.Item>
            <Form onSubmit={this.onSubmit}>
              <Input
                onChange={this.onSearchValueChange}
                action={{
                  icon: "search",
                  name: "搜尋",
                  onClick: this.onSubmit
                }}
                placeholder="搜尋藥局名稱或地址"
              />
            </Form>
          </Menu.Item>
          <Menu.Item style={{ marginLeft: "1.6rem" }}>
            <Button onClick={this.sortByGeolocation} basic>
              距離現在位置最近
            </Button>
          </Menu.Item>
        </Menu>
        <Segment id="main">
          <Table celled>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell colSpan={5}>
                  <Button
                    color="blue"
                    inverted={!this.state.adultMaskAvailable}
                    onClick={this.toggleAdultMaskAvailable}
                  >
                    尚有成人庫存
                  </Button>
                  <Button
                    color="blue"
                    inverted={!this.state.childMaskAvailable}
                    onClick={this.toggleChildrenMaskAvailable}
                  >
                    尚有孩童庫存
                  </Button>
                </Table.HeaderCell>
                <Table.HeaderCell>
                  每頁顯示
                  <Dropdown
                    inline
                    onChange={this.onPageSizeChange}
                    options={this.getPageOptions()}
                    defaultValue={this.state.pageSize}
                  />
                  筆資料
                </Table.HeaderCell>
              </Table.Row>
              <Table.Row>
                <Table.HeaderCell>名稱</Table.HeaderCell>
                <Table.HeaderCell>地址</Table.HeaderCell>
                <Table.HeaderCell>電話</Table.HeaderCell>
                <Table.HeaderCell>成人口罩庫存</Table.HeaderCell>
                <Table.HeaderCell>兒童口罩庫存</Table.HeaderCell>
                <Table.HeaderCell>資料最後更新時間</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>{this.renderPharmacyList()}</Table.Body>
            <Table.Footer>
              <Table.Row>
                <Table.HeaderCell colSpan="6">
                  <Menu floated="right" pagination>
                    <Menu.Item
                      as="a"
                      onClick={this.previousPages}
                      icon
                      disabled={this.state.startPage === 1}
                    >
                      <Icon name="chevron left" />
                    </Menu.Item>
                    {this.renderPageItems()}
                    <Menu.Item
                      as="a"
                      onClick={this.nextPages}
                      icon
                      disabled={!this.hasNext}
                    >
                      <Icon name="chevron right" />
                    </Menu.Item>
                  </Menu>
                </Table.HeaderCell>
              </Table.Row>
            </Table.Footer>
          </Table>
        </Segment>
      </>
    );
  }
}

export default App;
