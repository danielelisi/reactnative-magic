import React, { Component } from 'react';
import {
    StyleSheet,
    Text,
    View,
    Dimensions,
    ActivityIndicator
} from 'react-native';
import Zocial from 'react-native-vector-icons/Zocial';
import FAIcon from 'react-native-vector-icons/FontAwesome'


import Carousel from 'react-native-snap-carousel';

import AreaSpline from '../components/charts/AreaSpline';
import Pie from '../components/charts/Pie';
import CardComponent from '../components/CardComponent'
import colors from '../components/charts/colors'

import * as account from '../api/bittrex/account';
import * as market from '../api/bittrex/market'
import * as pub from '../api/bittrex/public'
import * as bitcoin from '../api/bittrex/bitcoin'
import creds from '../api/bittrex/creds';
import DropdownAlert from 'react-native-dropdownalert';

const {width, height} = Dimensions.get('screen');

export default class Dashboard extends Component{
 
    constructor(props){
        super(props);
        this.state = {
            /** PIE CHART RELATED STATES */
            activeIndex: 0,
            data: [],
            colors: [],
            theme: 'red',
            currencyInfo: [],
            totalBtcPortfolio: 0,
			btcPrice: 0,
			coinList:[],
        };

        this._onPieItemSelected = this._onPieItemSelected.bind(this);
        this._renderItem = this._renderItem.bind(this);

        this.getValue = this.getValue.bind(this);
        this.renderList = this.renderList.bind(this);

        this.horizontalMargin = 25;
        this.verticalMargin = 10;
    }

    /*************************************
     * BITTREX API RELATED FUNCTIONS
     ************************************/
    getBtcValue() {
        return new Promise(resolve=> {
            bitcoin.getEquivalent()
                .then( response => resolve(response.bpi.USD.rate_float))
                .catch( err => console.log(err))
        })
    }

    async queryBtcValue() {
        return await this.getBtcValue();
    }

    getMarketSummaries() {
        /*
         * Get the whole market with one API call then filter it in compute balances
         */
        return new Promise( resolve => {
            pub.getMarketSummaries()
                .then( response => resolve(response.result))
                .catch( err => console.log(err))
        });
    }

	computeBalances(balances, btcPrice) {
        let data = [];
        let counter = 0;

        return new Promise( async resolve => {
            let marketSummaries =  await this.getMarketSummaries();

            balances.forEach( (balance, index) => {
				
				let marketName = (balance.Currency === 'USDT' || balance.Currency === 'BTC') ? 'USDT-BTC' : 'BTC-'+ balance.Currency ; ;
                let holdings = balance.Available; 

                // search for the coin in the market summary
                let coinMarket = marketSummaries.find( market => market.MarketName === marketName);
                // console.log(coinMarket);

                let btcTotalValue, usdTotalValue;
                if(marketName === 'USDT-BTC') {
                    btcTotalValue = holdings / coinMarket.Last;
                    usdTotalValue = holdings;
                } else {
                    btcTotalValue = holdings * coinMarket.Last;
                    usdTotalValue = btcTotalValue * btcPrice;
                }
				
                let coin = this.state.coinList.Data[balance.Currency]
                
				let icon = {
					uri : `${this.state.coinList.BaseImageUrl}${coin.ImageUrl}`
				}

				if (coin===null) {
					icon = require('../assets/icons/cryptocurrency/0x.png')
				}
				data.push({   
					currency: balance.Currency, 
					holdings: holdings,
					price: coinMarket.Last,
					btcPrice: btcTotalValue,
					usdValue: usdTotalValue,
					longname: coin.CoinName, 
					icon: icon
				});
                
            });

            resolve(data)
        });
    }

    async componentDidMount() {

		let btcPrice = await this.queryBtcValue();
        let coinList = await bitcoin.getCoinList();

        if(this.props.screenProps.justOpened) {
            this.showAlert({
                key: 0, 
                backgroundColor: '#32A54A', 
                type: 'info',
                title: 'Navigation',
                message: 'Swipe from the left edge of the screen to see menu',
                closeInterval: 30000
            })
        }
        

        this.props.screenProps.didShow();

        this.setState({
			btcPrice,
			coinList
        });

        account.getBalances(creds.API_KEY, creds.API_SECRET)
            .then( async (balancesList) => {
                console.log('Dashboard Component Did Mount getBalances response:');
                // console.log(balancesList.result);
                let filteredBalances = balancesList.result.filter( coin => coin.Available > 0);
                let coinsData = await this.computeBalances(filteredBalances, btcPrice);
                this.setState(
                    {
                        data: coinsData
                    },
                    () => {

                        // sum array of btc values
                        let totalBtcPortfolio = this.state.data.map( item => item.btcPrice).reduce( (total, amount) => total + amount);

                        let colors = this._getRandomColors(this.state.data.length);
                        this.setState({
                            colors,
                            totalBtcPortfolio
                        });
                })
            })
            .catch( err => console.log(err));


    }

    // componentWillUnmount() {
    //     this._unsubscribe()
    // }

    /*************************************
     * PIE CHART RELATED FUNCTIONS
     ************************************/
    _getRandomColors(count) {

        return colors.slice(0, count);
    }

    _onPieItemSelected(newIndex){
        this.setState({...this.state, activeIndex: newIndex});
    }

    getValue(item) {
        return item.btcPrice;
    }

    _renderItem({item, index}) {

        const itemWidth = width - (this.horizontalMargin*2);

        return (
            <View style={{flex: 1, width: itemWidth}}>
                <CardComponent data={item} color = {this.state.colors[index]}/>
            </View>
        )
    }

    renderList(data, setSelectedIndex) {
        //getSelectedIndex : gets the current selectedIndex
        //setSelectedIndex : sets the selectedIndex
        // this._onPieItemSelected is the selecteditem function in the pie component

        const itemWidth = width - (this.horizontalMargin*2);

        return (
            <Carousel
                ref={(c) => { this._carousel = c; }}
                data={data}
                renderItem={this._renderItem} // loop trough elements in data array and passes singular item and index to function
                sliderWidth={width}
                itemWidth={itemWidth}
                onSnapToItem={setSelectedIndex}
                slideStyle={{flex:1,
                    marginTop: this.verticalMargin,
                    marginBottom: this.verticalMargin}}
            />
        )
    }

    /*************************************
     * ALERT RELATED FUNCTIONS
     *************************************/

    showAlert(item) {
        if (item.type == 'close') {
          this.closeAlert()
        } else {
          const title = item.title
          this.dropdown.alertWithType(item.type, title, item.message)
        }
      }
    closeAlert = () => {
        this.dropdown.close()
      }
    onClose(data) {
        console.log(data);
      }

    /*************************************
     * RENDER STARTS HERE
     ************************************/
    render() {
        return (
            <View style={styles.container} >

                <View style={styles.outerPortfolioValueContainer}>
                    <View style={styles.innerPortfolioValueContainer}>
                        <View style={[styles.innerContainer, {paddingBottom:0}]}>
                        <Zocial name="bitcoin" size={15} color="#fff" style={styles.portfolioValueIcons}/>
                        <Text style={[styles.portfolioLabel,{fontSize: width/27}]}>Total BTC </Text>
                        </View>
                        <Text style={[styles.portfolioValue, {fontSize: width/12, color:'#FFA500'}]}>{this.state.totalBtcPortfolio.toFixed(8)}</Text>
                    </View>
                    <View style={styles.innerPortfolioValueContainer}>
                        <View style={styles.innerContainer}>
                        <FAIcon name="money" size={18} color="#fff" style={styles.portfolioValueIcons}/>
                        <Text style={[styles.portfolioLabel,{fontSize: width/27}]}>Total USD </Text>
                        </View>
                        <Text style={[styles.portfolioValue,{fontSize: width/12, color: '#00FF00'}]}>${(this.state.totalBtcPortfolio * this.state.btcPrice).toFixed(2)}</Text>
                    </View>
                </View>

                <View style={styles.PieContainer} >
                    {this.state.data.length === 0 && <ActivityIndicator color={'green'} size={'large'}/>}
                    {this.state.data.length !== 0 &&
                    <Pie
                        highlightExpand={10}
                        thickness={50}
                        onItemSelected={this._onPieItemSelected}
                        colors={this.state.colors}
                        width={width}
                        height={height}
                        data={this.state.data}
                        renderListCallback={this.renderList}
                        valueAccessor={this.getValue} />
                    }
                </View>

                <DropdownAlert
                    ref={(ref) => this.dropdown = ref}
                    containerStyle={{
                        backgroundColor: '#2B73B6'
                    }}
                    showCancel={true}
                    onClose={(data) => this.onClose(data)}
                    onCancel={(data) => this.onClose(data)}
                />
            </View>

        )
    }
}


const styles = {
    container: {
        flex: 1,
        backgroundColor: '#191919',
        marginTop: 24
    },
    PieContainer: {
        flex: 1,
        justifyContent: 'center'
    },
    chart_title : {
        paddingTop: 10,
        textAlign: 'center',
        paddingBottom: 10,
        fontSize: 18,
        backgroundColor:'black',
        color: 'white',
        fontWeight:'bold',
    },   
    portfolioValueIcons: {
        marginRight: 4,
    },
    portfolioLabel: {
        textAlign: 'center',
        fontWeight: '100',
        color: '#ffffff',
    },    
    portfolioValue: {
        textAlign: 'center',
        fontWeight: 'bold',
        color: '#ffffff'
    },
    innerContainer: {
        flexDirection: 'row'
    },
    innerPortfolioValueContainer: {
        padding: 8,
        alignItems: 'flex-start',
        justifyContent: 'center',
        flexDirection: 'column'
    },
    outerPortfolioValueContainer: {
        flexDirection: 'row',
        backgroundColor: '#000'
    },
    valueContainer: {
        flexDirection: 'row',
        justifyContent:'center',
        alignItems: 'center'
    },
    label: {
        fontSize: 25,
        fontWeight: 'normal'
    }
}