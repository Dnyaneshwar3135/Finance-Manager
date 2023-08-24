//@ts-check

import { Component } from "../../core/Component.mjs"
import { Store } from "../../core/Store.mjs"
import { importStyle } from "../../utils/imports.js"
import { Router } from "../../core/Router.mjs"
import DOMPurify from 'https://unpkg.com/dompurify@3.0.0/dist/purify.es.js'
import { AuthManager } from "../../core/AuthManager.mjs"
import { PARTICIPANT_STATUSES } from "../../constants/userStatuses.mjs"
import { BudgetForm } from "../../components/BudgetForm/BudgetForm.mjs"
import { MapStoreAdapter, StoreAdapter } from "../../core/StoreAdapter.mjs"

importStyle('/src/containers/NewBudget/NewBudget.css')

const template = document.querySelector('template#new-budget-template')

const budgetsAdapter = new MapStoreAdapter('budgets')
const participantsAdapter = new StoreAdapter('participants')

export class NewBudget extends Component {
    containerId = 'create-form'
    form

    constructor() {
        super()
        this.form = new BudgetForm(this.handleSubmit, this.handleReset)
    }

    renderTo(parent) {
        //@ts-ignore
        const container = template.content.firstElementChild.cloneNode(true)
        parent.appendChild(container)
        this.form.renderTo(container)
        this.form.editable = true
    }

    async show() {
        await super.show()
        this.form.show()
        Store.subscribe('budgets', this.updateParticipantsList)
        this.updateParticipantsList()
    }

    async hide() {
        Store.subscribe('budgets', this.updateParticipantsList)
        this.form.hide()
        await super.hide()
    }

    updateParticipantsList = () => {
        this.suggestedParticipants = new Map(
            Object.values(participantsAdapter.getList())
                .flat()
                .filter(({ userId }) => userId !== AuthManager.data.id)
                .map(participant => [participant.userId, participant.user])
        )
        this.form.values = {
            ...this.form.values,
            suggestedParticipants: this.suggestedParticipants
        }
    }

    handleSubmit = async (event) => {
        event.preventDefault()
        if (this.isInProgress) {
            return false
        }
        const data = this.form.getFormData()
        const id = crypto.randomUUID()
        const name = DOMPurify.sanitize(data.get('name'))
        const currency = data.get('currency')
        const budget = {
            id,
            name,
            userId: AuthManager.data.id,
            type: data.get('isOpen') ? 'open' : 'private',
            currentUserStatus: PARTICIPANT_STATUSES.OWNER,
            currency,
        }
        const participants = [{
            id: AuthManager.data.id,
            status: PARTICIPANT_STATUSES.OWNER,
            user: {
                id: AuthManager.data.id,
                name: AuthManager.data.name,
            }
        }]
        for (const participant of this.suggestedParticipants ?? new Map()) {
            if (data.get(`participant-${participant[0]}`) === 'on') {
                participants.push({
                    id: participant[0],
                    status: PARTICIPANT_STATUSES.INVITED,
                    user: {
                        id: participant[0],
                        name: participant[1].name
                    }
                })
            }
        }
        try {
            this.isInProgress = true
            await budgetsAdapter.storeItem(budget)
            await participantsAdapter.store(id, participants)
            Router.navigate(`/budgets/${id}?fresh`)
        } catch (er) {
            const { Alert } = await import('../../components/Alert/Alert.mjs')
            new Alert('danger', er)
            console.error('Can\'t create budget', { er })
        } finally {
            this.isInProgress = false
        }
    }

    handleReset = () => {
        Router.navigate('/')
    }
}
