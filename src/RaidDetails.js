import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import axios from 'axios'
import { authToken } from './API'
import _ from 'lodash'
import FlexContainer from './FlexContainer'
import { validateEnchantments, validateGems } from './Validations'
import { getClassColor } from './ClassDetails'
import FailColumns from './FailColumns'
import BuffColumns from './BuffColumns'
import CastColumns from './CastColumns'
import Loading from './Loading'
import SpecRow from './SpecRow'

const RaidDetails = () => {

    //holds the id param from the URL
    //used to identify the user that we are editing
    const {id} = useParams()

    const [players, setPlayers] = useState(null)

    const [totalCombatTime, setTotalCombatTime] = useState(0)

    const [title, setTitle] = useState(null)

    const [isLoading, setIsLoading] = useState(true)

    const [error, setError] = useState(false)

    var unValidatedPlayers = []

    const buffsColumns = [
      {id:33256, name:"Well Fed",          uses:true,  uptime:true},
      {id:33082, name:"Strength V",        uses:true,  uptime:true},
      {id:28520, name:"Relentless Assult", uses:false, uptime:true}
    ]
    //28521 28518 28540 28520 flask
    //33261 43771 33257 33263 33254 33268 43764 33256 well fed

    const castsColumns = [
      {id:28507, name:"Haste Potion",      uses:true},
      {id:35476, name:"Drums of Battle",   uses:true}
    ]

    const getRaidInfo = () =>{

        setIsLoading(true)

        axios.request({
          url: "api/v2/client",
          method: "post",
          baseURL: "https://classic.warcraftlogs.com/",
          headers: {
            "Authorization": `Bearer ${authToken}`
          },
          data:{
            query:`{
              reportData {
                report(code:"${id}"){
                  title
                  fights{
                    startTime
                    endTime
                    encounterID
                    name
                  }
                  table(startTime:0, endTime:15000000)
                }
              }
            }`
          }
        }).then(function(res) {
            if(res.data.data){
              var fights = res.data.data.reportData.report.fights
              var dps = res.data.data.reportData.report.table.data.playerDetails.dps
              var healers = res.data.data.reportData.report.table.data.playerDetails.healers
              var tanks = res.data.data.reportData.report.table.data.playerDetails.tanks
              
              var tempTotalCombatTime = 0

              fights.forEach((fight)=>{
                if(fight.encounterID > 0){
                  tempTotalCombatTime = tempTotalCombatTime + (fight.endTime - fight.startTime)
                }
              })

              setTotalCombatTime(tempTotalCombatTime)

              tanks.forEach((tank)=>{

                dps.forEach((player, i)=>{
                  if(player.type === "Unknown"){
                    dps.splice(i,1)
                  }
                  else{
                    if(tank.name === player.name){
                      tank.combatantInfo.gear = _.union(tank.combatantInfo.gear, player.combatantInfo.gear)
                      dps.splice(i, 1)
                    }
                  }
                })

                healers.forEach((healer, i)=>{
                  if(tank.name === healer.name){
                    tank.combatantInfo.gear = _.union(tank.combatantInfo.gear, healer.combatantInfo.gear)
                    healer.splice(i, 1)
                  }
                })
              })

              healers.forEach((healer)=>{

                dps.forEach((player, i)=>{
                  if(healer.name === player.name){
                    healer.combatantInfo.gear = _.union(healer.combatantInfo.gear, player.combatantInfo.gear)
                    dps.splice(i, 1)
                  }
                })
              })

              unValidatedPlayers = _.union(dps, healers, tanks)
              unValidatedPlayers.forEach((player, index, object)=>{
                if(player.combatantInfo.gear){
                  player.failedEnchants = validateEnchantments(player.combatantInfo.gear, player.specs[0])
                  player.failedGems = validateGems(player.combatantInfo.gear)
                }
                else{
                  object.splice(index, 1)
                }
              })
              setPlayers(_.cloneDeep(unValidatedPlayers))
              setTitle(res.data.data.reportData.report.title)
            }
            else{
              setError(true)
              setIsLoading(false)
            }
        }).then(()=>{
          if(!error){

            var queryString = ''
            unValidatedPlayers.forEach(player=>{
              queryString = queryString + `Buffs${player.id} : table(sourceID:${player.id}, dataType:Buffs, startTime:0, endTime:15000000)\n`
              queryString = queryString + `Casts${player.id} : table(sourceID:${player.id}, dataType:Casts, startTime:0, endTime:15000000)\n`
            })

            axios.request({
              url: "api/v2/client",
              method: "post",
              baseURL: "https://classic.warcraftlogs.com/",
              headers: {
                "Authorization": `Bearer ${authToken}`
              },
              data:{
                query:`{
                  reportData {
                    report(code:"${id}"){
                      ${queryString}
                    }
                  }
                }`
              }
            }).then((res)=>{

              if(res.data.data){
                unValidatedPlayers.forEach((player)=>{
                  player.buffs = res.data.data.reportData.report[`Buffs${player.id}`].data.auras
                  player.casts = res.data.data.reportData.report[`Casts${player.id}`].data.entries
                })
                setPlayers(_.cloneDeep(unValidatedPlayers))
              }else{
                setError(true)
                setIsLoading(false)
              }
            }).then(()=>{
              setIsLoading(false)
            })
          }
        })
      }

    useEffect(() => {
      if(!players){
        getRaidInfo()
      }
    }, [])

    return ( isLoading ? <Loading/> :
        <FlexContainer>
            <h1>{title}</h1>
            {error ? <div>Error with this log.</div> :
            <div>
              <div style={{display:'flex', position:'sticky'}}>
                <div style={{width:48}}></div>
                <div style={{width:125, fontWeight:500}}>Player Name</div>
                {castsColumns.map((cast)=>{
                  return(
                    <div style={{width:125, fontWeight:500}}>
                      <div>{cast.name}</div>
                      <div>{cast.uses?<span>Uses</span>:null}{cast.uses && cast.uptime ? <span> - </span>:null}{cast.uptime ? <span>Up Time</span>:null}</div>
                    </div>
                  )
                })}
                {buffsColumns.map((buff)=>{
                  return(
                    <div style={{width:125, fontWeight:500}}>
                      <div>{buff.name}</div>
                      <div>{buff.uses?<span>Uses</span>:null}{buff.uses && buff.uptime ? <span> - </span>:null}{buff.uptime ? <span>Up Time</span>:null}</div>
                    </div>
                  )
                })}
                <div style={{width:300, fontWeight:500}}>Enchant Fails</div>
                <div style={{width:300, fontWeight:500}}>Gem Fails</div>
              </div>
               <SpecRow players={players} spec={"Protection"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
               <SpecRow players={players} spec={"Feral"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
               <SpecRow players={players} spec={"Warden"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
               <SpecRow players={players} spec={"Holy"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
               <SpecRow players={players} spec={"Discipline"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
               <SpecRow players={players} spec={"Restoration"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
               <SpecRow players={players} spec={"Fury"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
               <SpecRow players={players} spec={"Arms"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
               <SpecRow players={players} spec={"Combat"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
               <SpecRow players={players} spec={"Subtlety"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
               <SpecRow players={players} spec={"Assasination"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
               <SpecRow players={players} spec={"Enhancement"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
               <SpecRow players={players} spec={"Retribution"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
               <SpecRow players={players} spec={"BeastMastery"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
               <SpecRow players={players} spec={"Survival"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
               <SpecRow players={players} spec={"Marksmanship"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
               <SpecRow players={players} spec={"Frost"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
               <SpecRow players={players} spec={"Fire"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
               <SpecRow players={players} spec={"Arcane"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
               <SpecRow players={players} spec={"Destruction"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
               <SpecRow players={players} spec={"Affliction"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
               <SpecRow players={players} spec={"Demonology"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
               <SpecRow players={players} spec={"Shadow"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
               <SpecRow players={players} spec={"Balance"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
               <SpecRow players={players} spec={"Elemental"} castsColumns={castsColumns} buffsColumns={buffsColumns} totalCombatTime={totalCombatTime}/>
            </div>}
        </FlexContainer>
    )
}

export default RaidDetails
