import { LightningElement,track } from 'lwc';
import { loadStyle,loadScript } from 'lightning/platformResourceLoader';
const URL= "https://services9.arcgis.com/N9p5hsImWXAccRNI/arcgis/rest/services/Z7biAeD8PAkqgmWhxG2A/FeatureServer/1/query?f=json&where=Confirmed%20%3E%200&outFields=Country_Region,Confirmed,Deaths,Recovered,Last_Update,Active&orderByFields=Confirmed%20desc";
let initialValue={
    total_confirmed : 0,
    total_deaths : 0,
    total_active : 0,
    total_recovered :0,
    fatality_rate: 0,
    recovery_rate: 0
}
let status = ["Confirmed","Active","Deaths","Recovered"]
let colors={"Confirmed":'#007bff', "Active":"#dd9105", "Recovered":"#28a745", "Deaths":"#dc3545"}

export default class CovidDashboardApp extends LightningElement {

    @track total=initialValue
    @track showListView
    @track defaultView='LIST'
    @track tableData=[]
    @track filteredtableData=[]
    @track countrySelected='China'
    @track graphData=[]
    chartInitialized = false;
    //we have to use here @track because imitially this value is 0 and
    //later this is changed after fetching the data from the URL. if you want
    //to re-render the data again after change, then @track should be used.
    connectedCallback(){
        this.fetchData()
    }
    renderedCallback() {
        if (this.chartInitialized) {
            return;
        }
        this.chartInitialized = true;

        Promise.all([
            loadScript(this, 'https://code.highcharts.com/highcharts.js')
        ])
            .then(() => {
                this.initializeChart();
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error loading D3',
                        message: error.message,
                        variant: 'error'
                    })
                );
            });
    }

    get isChartSelected(){
       return this.defaultView==='CHART'?'active':''
    }
    get isListSelected(){
        return this.defaultView==='LIST'?'active':''
     }
    async fetchData(){
        let response = await fetch(URL);
        let data = await response.json()
        console.log(JSON.stringify(data));
        this.formatData(data)
    }

    formatData(result){
        console.log(result.features);
        let dataByCountry={}
        result.features.forEach(data=>{
            let item =data.attributes 
            let dataByCountryItem={
                Confirmed:item.Confirmed,
                Deaths:item.Deaths,
                Active:item.Active,
                Recovered:item.Recovered,
                Last_Update:item.Last_Update
            }
            if(item.Country_Region in dataByCountry ){
                dataByCountry[item.Country_Region].Confirmed +=dataByCountryItem.Confirmed
                dataByCountry[item.Country_Region].Deaths +=dataByCountryItem.Deaths
                dataByCountry[item.Country_Region].Active +=dataByCountryItem.Active
                dataByCountry[item.Country_Region].Recovered +=dataByCountryItem.Recovered
            }
            else{
                dataByCountry[data.attributes.Country_Region]= dataByCountryItem
            }
            this.total.total_confirmed +=item.Confirmed
            this.total.total_deaths += item.Deaths
            this.total.total_active += item.Active
            this.total.total_recovered += item.Recovered
        })
        this.total.fatality_rate = this.getFRate().toFixed(2)+'%';
        this.total.recovery_rate = this.getRRate().toFixed(2)+'%';

        let finalData=Object.keys(dataByCountry).map(country =>{
        let finalDataItem=dataByCountry[country]
        let formattedLastUpdatedDate = new Date(finalDataItem.Last_Update).toDateString()
        let finalDataItemFR = this.getFRate(finalDataItem).toFixed(2)+'%';
        let finalDataItemRR = this.getRRate(finalDataItem).toFixed(2)+'%';
        
        let activeColumnClass =  finalDataItem.Recovered < finalDataItem.Active ? "activeColumnClass" : "" 
        let recoveredColumnClass = finalDataItem.Recovered > finalDataItem.Active ? "recoveredColumnClass" : ""
        let fatalityColumnClass = this.getFRate(finalDataItem) > this.getFRate()? "fatalityColumnClass-danger" : 
        this.getFRate(finalDataItem) < this.getFRate() ? "fatalityColumnClass-success":""
        let recoveryColumnClass = this.getRRate(finalDataItem) > this.getRRate() ? "recoveryColumnClass-success" : 
        this.getRRate(finalDataItem) < this.getRRate() ? "recoveryColumnClass-warning":""
        return {...finalDataItem,"formattedDate":formattedLastUpdatedDate , "fatality_rate":finalDataItemFR,
        "recovery_rate": finalDataItemRR,"Country_Region":country,
    
        "activeColumnClass":activeColumnClass,
        "recoveredColumnClass":recoveredColumnClass,
        "fatalityColumnClass":fatalityColumnClass,
        "recoveryColumnClass":recoveryColumnClass}
   
       
    })
    this.tableData = [...finalData]
    this.filteredtableData=[...finalData]
    this.generateCountryList(dataByCountry)
        console.log(JSON.stringify(finalData));

    }
    generateCountryList(finalData){
        this.countryList= Object.keys(finalData).map(item=>{
                 return { label: item, value: item }
         })
         
 }

    getFRate(item){
        if(item){
            return (item.Deaths/item.Confirmed)*100
        }else{
        return (this.total.total_deaths/this.total.total_confirmed)*100
        }
    }
        

    getRRate(item){
        if(item){
            return (item.Recovered/item.Confirmed)*100
        }
        else{
            return (this.total.total_recovered/this.total.total_confirmed)*100
        }
    }
        
/** Toggle view handler */
listHandler(event){
    console.log(event.target.dataset.name)
    this.defaultView = event.target.dataset.name
    if(event.target.dataset.name=== 'LIST'){
        this.showListView=true      
    } else {
        this.showListView= false    
        this.triggerCharts()   
    }
}

searchHandler(event){
    console.log(event.target.value)
    let searchKey=event.target.value
    if(searchKey.trim()){
        let filterData=this.tableData.filter(data=>{
            let country = data.Country_Region?data.Country_Region.toLowerCase():data.Country_Region
            return country.includes(searchKey)

        })
        this.filteredtableData=[...filterData]
    }else{
        this.filteredtableData=[...this.tableData]
    }

}

triggerCharts(){
    let dataBycountrySelected = this.tableData.filter(item=>{
       return item.Country_Region===  this.countrySelected 
    })

    this.graphData = status.map(item=>{
        return {name:item, color:colors[item], y:dataBycountrySelected[0][item]}
    }) 
    console.log(JSON.stringify(this.graphData))
    window.setTimeout(()=>{
        this.initializeChart()},1000)
}

initializeChart(){
    let container = this.template.querySelector('.chartContainer')
    highcharts.chart(container, {
    chart: {
        type: 'column'
    },
    title: {
        text: `COVID-19 in ${this.countrySelected}`
    },
    xAxis: {
        categories: ['Confirmed', 'Active', 'Recovered', 'Deaths']
    },
    tooltip: {
        headerFormat: '<span style="font-size:11px">{series.name}</span><br>',
        pointFormat: '<span style="color:{point.color}">{point.name}</span>: <b>{point.y}</b> <br/>'
    },
    legend: {
        enabled: false
    },

    series: [{
            name: `COVID-19 data of ${this.countrySelected}`,
        data: this.graphData
    }]
    });
}
}